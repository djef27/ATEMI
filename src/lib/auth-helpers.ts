import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAppUrl } from '@/lib/app-url';
import { getClientIp } from '@/lib/request';

// ---------------------------------------------------------------------------
// Centralized authorization helpers for vendor & admin API routes.
//
// Usage in route handlers:
//
//   const auth = await requireVendorAuth(request);
//   if ('error' in auth) return auth.error;
//   // auth.vendorId, auth.supabase available
//
//   const admin = await requireAdminAuth(request);
//   if ('error' in admin) return admin.error;
//   // admin.supabase available
// ---------------------------------------------------------------------------

export interface VendorAuth {
  vendorId: string;
  isAdmin: boolean;
  supabase: SupabaseClient;
}

export interface AdminAuth {
  supabase: SupabaseClient;
}

export interface AuthError {
  error: NextResponse;
}

// Resolved lazily (not at module load) so a misconfigured app URL can never
// crash route imports; the failure is contained to an origin check.
function getAllowedOrigins(): string[] {
  const configured: string[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) configured.push(supabaseUrl);
  try {
    configured.push(getAppUrl());
  } catch (error) {
    console.error(
      '[AUTH] Unable to resolve app URL for origin checks:',
      error instanceof Error ? error.message : String(error)
    );
  }
  return configured;
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (process.env.NODE_ENV !== 'production') return true;
  if (!origin && !referer) return false;
  const matchesAllowedOrigin = (value: string) => {
    try {
      const candidate = new URL(value);
      return getAllowedOrigins().some((allowed) => {
        if (!allowed) return false;
        const expected = new URL(allowed);
        return candidate.protocol === expected.protocol
          && candidate.hostname === expected.hostname
          && candidate.port === expected.port;
      });
    } catch {
      return false;
    }
  };

  if (origin && matchesAllowedOrigin(origin)) return true;
  if (referer && matchesAllowedOrigin(referer)) return true;
  return false;
}

/**
 * Require authenticated user with vendor or admin role.
 * Returns vendorId + admin flag + admin supabase client.
 */
export async function requireVendorAuth(request: Request): Promise<VendorAuth | AuthError> {
  const authSupabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await authSupabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await authSupabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || (profile.role !== 'vendor' && profile.role !== 'admin') || !profile.is_active) {
    return { error: NextResponse.json({ success: false, error: 'Accès non autorisé' }, { status: 403 }) };
  }

  const supabase = createAdminSupabaseClient();
  const isAdmin = profile.role === 'admin';

  if (isAdmin) {
    // Admin: no vendor lookup needed, but return a dummy vendorId
    return { vendorId: '', isAdmin: true, supabase };
  }

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .limit(1);

  if (!vendor || vendor.length === 0) {
    return { error: NextResponse.json({ success: false, error: 'Profil vendeur introuvable ou inactif' }, { status: 400 }) };
  }

  return { vendorId: vendor[0].id, isAdmin: false, supabase };
}

/**
 * Require authenticated user with admin role ONLY.
 */
export async function requireAdminAuth(request: Request): Promise<AdminAuth | AuthError> {
  const authSupabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await authSupabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await authSupabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
    return { error: NextResponse.json({ success: false, error: 'Accès administrateur requis' }, { status: 403 }) };
  }

  const supabase = createAdminSupabaseClient();
  return { supabase };
}

/**
 * Verify that a product belongs to the given vendor (or user is admin).
 * Returns the product data if authorized, or an error response.
 */
export async function requireProductOwner(
  supabase: SupabaseClient,
  productId: string,
  vendorId: string,
  isAdmin: boolean
): Promise<{ product: Record<string, unknown> } | AuthError> {
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (fetchError || !product) {
    return { error: NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 }) };
  }

  if (!isAdmin && product.vendor_id !== vendorId) {
    return { error: NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 }) };
  }

  return { product };
}

/**
 * Verify that a media item belongs to a product owned by the given vendor.
 */
export async function requireMediaOwner(
  supabase: SupabaseClient,
  mediaId: string,
  vendorId: string,
  isAdmin: boolean
): Promise<{ image: { id: string; product_id: string } } | AuthError> {
  const { data: image, error: imageError } = await supabase
    .from('product_images')
    .select('id, product_id')
    .eq('id', mediaId)
    .single();

  if (imageError || !image) {
    return { error: NextResponse.json({ success: false, error: 'Image introuvable' }, { status: 404 }) };
  }

  if (!isAdmin) {
    const { data: product } = await supabase
      .from('products')
      .select('vendor_id')
      .eq('id', image.product_id)
      .single();

    if (!product || product.vendor_id !== vendorId) {
      return { error: NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 }) };
    }
  }

  return { image };
}

// ---------------------------------------------------------------------------
// withAdminAuth — centralised wrapper for all admin API routes.
//
// Usage:
//   export const POST = withAdminAuth(async (request, { supabase }) => {
//     // supabase is an admin client, user is guaranteed admin
//     return NextResponse.json({ success: true });
//   });
// ---------------------------------------------------------------------------

type AdminHandler = (
  request: NextRequest,
  ctx: {
    supabase: SupabaseClient;
    userId: string;
    params: Promise<Record<string, string>>;
  }
) => Promise<NextResponse>;

export function withAdminAuth(handler: AdminHandler) {
  return async (
    request: NextRequest,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    // 1. CSRF check
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { success: false, error: 'Origine non autorisée' },
        { status: 403 }
      );
    }

    // 2. Auth check
    const auth = await requireAdminAuth(request);
    if ('error' in auth) return auth.error;

    // 3. Get userId from session (for rate limiting + handler)
    const authSupabase = await createServerSupabaseClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    // 4. Rate limit (per-user, not shared 'admin' bucket)
    const rl = await checkRateLimit(user.id, RATE_LIMIT_CONFIGS.adminMutation);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Trop de requêtes. Réessayez dans ${Math.ceil(rl.retryAfterMs / 1000)}s` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    return handler(request, {
      supabase: auth.supabase,
      userId: user.id,
      params: routeCtx?.params ?? Promise.resolve({}),
    });
  };
}

// ---------------------------------------------------------------------------
// withRateLimit — simple rate-limit wrapper for any route handler.
// ---------------------------------------------------------------------------

type RateLimitedHandler = (request: NextRequest) => Promise<NextResponse>;

export function withRateLimit(
  config: typeof RATE_LIMIT_CONFIGS[keyof typeof RATE_LIMIT_CONFIGS],
  handler: RateLimitedHandler
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    // Trust only the platform-provided client IP (never a spoofable
    // client-supplied x-forwarded-for) to keep rate-limit buckets honest.
    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip, config);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Trop de requêtes. Réessayez dans ${Math.ceil(rl.retryAfterMs / 1000)}s` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }
    return handler(request);
  };
}
