import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/auth-helpers';
import { isContentEngineEnabled } from './enabled';

export { isContentEngineEnabled };

const DISABLED_RESPONSE = NextResponse.json(
  {
    success: false,
    error:
      'Content Engine désactivé — définir CONTENT_ENGINE_ENABLED=true après avoir implémenté les fournisseurs IA et les intégrations réseaux sociaux.',
  },
  { status: 503 }
);

/**
 * Admin-guarded wrapper for content-engine routes.
 * Returns 503 while the feature flag is off, before doing any auth/DB work.
 */
export function withContentAdminAuth(
  handler: (
    request: NextRequest,
    ctx: {
      supabase: SupabaseClient;
      userId: string;
      params: Promise<Record<string, string>>;
    }
  ) => Promise<NextResponse>
) {
  const wrapped = withAdminAuth(handler);
  return async (
    request: NextRequest,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    if (!isContentEngineEnabled()) {
      return DISABLED_RESPONSE;
    }
    return wrapped(request, routeCtx);
  };
}