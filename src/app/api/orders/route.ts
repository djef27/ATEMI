import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-rate-limit';
import { sendEmail, orderConfirmationEmail } from '@/lib/email';
import { z } from 'zod';
import { checkoutCustomerFieldsSchema } from '@/lib/validations';
import { getPaymentConfig } from '@/lib/payment/config';
import { normalizeCity } from '@/lib/delivery-zones';
import { isGeographicCountry } from '@/lib/geography-data';
import { getOrderCreationError } from '@/lib/order-errors';
import {
  checkIdempotencyKey,
  generateRequestHash,
  getIdempotencyKey,
  storeIdempotencyResponse,
  type IdempotencyContext,
} from '@/lib/idempotency';
import { getClientIp } from '@/lib/request';

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
  product_id: z.string({ invalid_type_error: 'Identifiant de produit invalide.' }).uuid('Identifiant de produit invalide.'),
  quantity: z.number({ invalid_type_error: 'Quantité invalide.' }).int('Quantité invalide.').min(1, 'Quantité minimale : 1.').max(100, 'Quantité maximale : 100.'),
});

const createOrderSchema = checkoutCustomerFieldsSchema.extend({
  delivery_zone_id: z.string({ invalid_type_error: 'Zone de livraison invalide.' }).uuid('Zone de livraison invalide.').nullable().optional(),
  delivery_required: z.boolean({ invalid_type_error: 'Mode de livraison invalide.' }).default(true),
  country: z.string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/, 'Veuillez choisir un pays valide.'))
    .default('BJ'),
  items: z.array(orderItemSchema, { invalid_type_error: 'Le panier est invalide.' }).min(1, 'Panier vide').max(20, 'Trop d\'articles'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting (fail-closed on financial endpoints: 429 for a spent
    //    quota, 503 when Redis is unavailable — never a free pass).
    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip, RATE_LIMIT_CONFIGS.orderCreate);
    const rateLimited = rateLimitResponse(rl);
    if (rateLimited) return rateLimited;

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
      const issue = parsed.error.issues[0];
      const firstError = issue?.message || 'Données invalides';
      return NextResponse.json(
        {
          success: false,
          error: firstError,
          field: typeof issue?.path[0] === 'string' ? issue.path[0] : undefined,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    let deliveryZoneId = data.delivery_zone_id || null;

    if (!isGeographicCountry(data.country)) {
      return NextResponse.json(
        { success: false, error: 'Veuillez choisir un pays valide.', field: 'country' },
        { status: 400 }
      );
    }

    // 3. Validate delivery fields based on delivery_required
    if (data.delivery_required) {
      if (!data.delivery_address || data.delivery_address.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Adresse de livraison requise', field: 'delivery_address' },
          { status: 400 }
        );
      }
      if (!data.delivery_city || data.delivery_city.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Ville de livraison requise', field: 'delivery_city' },
          { status: 400 }
        );
      }

      const normalizedCity = data.delivery_city.trim();
      const country = data.country;
      const supabase = createAdminSupabaseClient();
      const { data: availableZones, error: zoneError } = await supabase
        .from('delivery_zones')
        .select('id, city, zone_name, delivery_fee')
        .eq('country', country)
        .eq('is_active', true)
        .eq('is_available', true);

      if (zoneError) {
        console.error('[ORDER_DELIVERY_ZONES_ERROR]', zoneError.message, zoneError.code);
        return NextResponse.json(
          { success: false, error: 'Impossible de vérifier la zone de livraison' },
          { status: 503 }
        );
      }

      // The country has a small, bounded set of zones. Normalize their city
      // names in JavaScript so checkout validation matches the public zone API
      // even if the generated city_normalized column is stale or unavailable.
      const zoneRows = (availableZones || []).filter(
        (zone) => normalizeCity(zone.city) === normalizeCity(normalizedCity)
      );

      if (zoneRows.length === 0) {
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

      if (!deliveryZoneId && zoneRows.length === 1) {
        deliveryZoneId = zoneRows[0].id;
      }

      if (!deliveryZoneId) {
        return NextResponse.json(
          { success: false, error: 'Veuillez sélectionner une zone de livraison' },
          { status: 400 }
        );
      }
    }

    // 4. Get user session (optional for guest checkout)
    const authSupabase = await createServerSupabaseClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    // 4b. Idempotency check — prevent duplicate orders from double-submit.
    // Always active: the key falls back to a deterministic method+URL+body-hash
    // when the client does not send an Idempotency-Key header, so a script or a
    // third-party page cannot bypass the deduplication.
    const idempotencyKey = getIdempotencyKey(request, 'order:create', data);
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
    if (!idempotencyResult.isNew) {
      // The key row is inserted by the RPC at check time, so a replay that has
      // no stored response means a previous attempt created the order but failed
      // to persist its response. Falling through would create a SECOND order.
      if (idempotencyResult.existingResponse) {
        return NextResponse.json(idempotencyResult.existingResponse);
      }
      return NextResponse.json(
        {
          success: false,
          error: 'Une commande identique est déjà en cours de traitement, réessayez dans quelques secondes',
        },
        { status: 409 }
      );
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
      p_delivery_zone_id: deliveryZoneId,
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

    // 6. Persist the idempotency response BEFORE the confirmation email: the
    //    email is fire-and-forget and must not delay the replay path. A failed
    //    store is logged but never turns a successful order into an error
    //    response (the 409 replay guard above already blocks the retry).
    await storeIdempotencyResponse(idempotencyKey, 200, { success: true, data: rpcData });

    // 7. Send confirmation email (fire-and-forget)
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
