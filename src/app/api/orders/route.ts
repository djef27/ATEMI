import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { sendEmail, orderConfirmationEmail } from '@/lib/email';
import { z } from 'zod';
import { getPaymentConfig } from '@/lib/payment/config';
import { isSupportedCountry, normalizeCity, isUndefinedColumnError } from '@/lib/delivery-zones';
import { getOrderCreationError } from '@/lib/order-errors';
import {
  checkIdempotencyKey,
  generateRequestHash,
  storeIdempotencyResponse,
  type IdempotencyContext,
} from '@/lib/idempotency';

/**
 * POST /api/orders
 *
 * Creates a new order with rate limiting and server-side validation.
 * Replaces direct client RPC calls to create_order.
 *
 * Security:
 *   1. Method check (POST only)
 *   2. Rate limiting (per-user/IP)
 *   3. Authentication (optional for guest checkout)
 *   4. Input validation (Zod)
 *   5. Server-side RPC (create_order)
 */

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
});

const createOrderSchema = z.object({
  customer_name: z.string().min(1, 'Nom requis').max(200),
  customer_phone: z.string().min(1, 'Téléphone requis').max(20),
  customer_email: z.string().email('Email invalide').max(200).nullable().optional().or(z.literal('')),
  customer_whatsapp: z.string().max(20).nullable().optional(),
  delivery_address: z.string().max(500).nullable().optional(),
  delivery_city: z.string().max(100).nullable().optional(),
  delivery_zone_id: z.string().uuid().nullable().optional(),
  delivery_required: z.boolean().default(true),
  country: z.enum(['BJ', 'CI', 'TG']).default('BJ'),
  customer_notes: z.string().max(500).nullable().optional(),
  items: z.array(orderItemSchema).min(1, 'Panier vide').max(20, 'Trop d\'articles'),
});

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip, RATE_LIMIT_CONFIGS.orderCreate);

    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Trop de requêtes. Réessayez dans ${Math.ceil(rl.retryAfterMs / 1000)}s`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
          },
        }
      );
    }

    // 2. Parse + validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Body invalide' },
        { status: 400 }
      );
    }

    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 3. Validate delivery fields based on delivery_required
    if (data.delivery_required) {
      if (!data.delivery_address || data.delivery_address.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Adresse de livraison requise' },
          { status: 400 }
        );
      }
      if (!data.delivery_city || data.delivery_city.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Ville de livraison requise' },
          { status: 400 }
        );
      }

      const normalizedCity = data.delivery_city.trim();
      const country = data.country;
      if (!isSupportedCountry(country)) {
        return NextResponse.json(
          { success: false, error: 'Pays de livraison non pris en charge' },
          { status: 400 }
        );
      }
      const supabase = createAdminSupabaseClient();
      const zoneQuery = () => supabase
        .from('delivery_zones')
        .select('id, city, zone_name, delivery_fee')
        .eq('country', country)
        .eq('is_active', true)
        .eq('is_available', true);

      let { data: zoneRows, error: zoneError } = await zoneQuery()
        .eq('city_normalized', normalizeCity(normalizedCity));

      if (zoneError && isUndefinedColumnError(zoneError)) {
        const fallback = await zoneQuery();
        zoneError = fallback.error;
        zoneRows = (fallback.data || []).filter(
          (zone) => normalizeCity(zone.city) === normalizeCity(normalizedCity)
        );
      }

      if (zoneError) {
        console.error('[ORDER_DELIVERY_ZONES_ERROR]', zoneError.message, zoneError.code);
        return NextResponse.json(
          { success: false, error: 'Impossible de vérifier la zone de livraison' },
          { status: 400 }
        );
      }

      if (!zoneRows || zoneRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Aucune zone de livraison disponible pour cette ville. Modifiez la ville ou choisissez le retrait.' },
          { status: 400 }
        );
      }

      if (data.delivery_zone_id && !zoneRows.some((zone) => zone.id === data.delivery_zone_id)) {
        return NextResponse.json(
          { success: false, error: 'Zone de livraison invalide pour cette ville' },
          { status: 400 }
        );
      }

      if (!data.delivery_zone_id && zoneRows.length > 1) {
        return NextResponse.json(
          { success: false, error: 'Veuillez sélectionner une zone de livraison' },
          { status: 400 }
        );
      }
    }

    // 4. Get user session (optional for guest checkout)
    const authSupabase = await createServerSupabaseClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    // 4b. Idempotency check — prevent duplicate orders from double-submit
    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey) {
      const idempotencyContext: IdempotencyContext = {
        requesterType: 'customer',
        requesterId: user?.id || 'guest',
        requestMethod: 'POST',
        requestPath: '/api/orders',
      };
      const idempotencyResult = await checkIdempotencyKey(
        idempotencyKey,
        idempotencyContext,
        generateRequestHash(data)
      );

      if (idempotencyResult.error === 'IDEMPOTENCY_KEY_CONFLICT') {
        return NextResponse.json(
          { success: false, error: 'Clé d\'idempotence réutilisée avec des données différentes' },
          { status: 409 }
        );
      }
      if (idempotencyResult.error) {
        console.error('[ORDER_IDEMPOTENCY_ERROR]', idempotencyResult.error);
        return NextResponse.json(
          { success: false, error: 'Erreur de vérification de la commande' },
          { status: 500 }
        );
      }
      if (!idempotencyResult.isNew && idempotencyResult.existingResponse) {
        return NextResponse.json(idempotencyResult.existingResponse);
      }
    }

    // 5. Call server-side RPC via admin client
    const supabase = createAdminSupabaseClient();

    const { data: rpcData, error: rpcError } = await supabase.rpc('create_order', {
      p_customer_name: data.customer_name.trim(),
      p_customer_phone: data.customer_phone.trim(),
      p_delivery_address: data.delivery_address?.trim() || null,
      p_delivery_city: data.delivery_city?.trim() || null,
      p_items: data.items,
      p_customer_whatsapp: data.customer_whatsapp?.trim() || null,
      p_delivery_zone_id: data.delivery_zone_id || null,
      p_delivery_required: data.delivery_required,
      p_customer_notes: data.customer_notes?.trim() || null,
      p_customer_id: user?.id || null,
      p_customer_email: data.customer_email?.trim() || null,
      p_provider: getPaymentConfig().provider,
    });

    if (rpcError) {
      // Log the actual error for debugging (server-side only)
      console.error('[ORDER_RPC_ERROR]', rpcError.message, rpcError.code, rpcError.details);
      const failure = getOrderCreationError(rpcError);
      return NextResponse.json(
        { success: false, error: failure.message },
        { status: failure.status }
      );
    }

    // 6. Send confirmation email (fire-and-forget)
    if (data.customer_email && rpcData && typeof rpcData === 'object' && 'order_number' in rpcData) {
      const orderData = rpcData as {
        order_id: string;
        order_number: string;
        tracking_token: string;
        subtotal: number;
        delivery_fee: number;
        total_amount: number;
        deposit_amount: number;
        delivery_balance: number;
      };

      // Amounts come from create_order, never from a client-side recomputation:
      // the database is the single source of truth (and it includes the
      // delivery fee, which the previous client-side math silently dropped).
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_name, quantity, unit_price')
        .eq('order_id', orderData.order_id);

      const items = (orderItems || []).map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        price: Number(i.unit_price),
      }));

      const emailPayload = orderConfirmationEmail({
        orderNumber: orderData.order_number,
        customerName: data.customer_name,
        items,
        deposit: Number(orderData.deposit_amount ?? 0),
        remaining: Number(orderData.delivery_balance ?? 0),
        deliveryFee: Number(orderData.delivery_fee ?? 0),
        total: Number(orderData.total_amount ?? 0),
        deliveryAddress: data.delivery_address || undefined,
        trackingToken: orderData.tracking_token,
      });
      sendEmail({ to: data.customer_email, ...emailPayload }).catch(() => {});
    }

    // 7. Store idempotency key for future duplicate prevention
    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 200, { success: true, data: rpcData });
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      data: rpcData,
    });
  } catch (error) {
    console.error(
      '[ORDER_CREATE_ERROR]',
      error instanceof Error ? error.message : 'Unknown order creation error'
    );
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// Reject non-POST methods
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}
