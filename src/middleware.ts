import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

const PUBLIC_API_PATHS = [
  '/api/whatsapp/webhook',
  '/api/payment/webhook',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip session refresh for public API paths (Meta webhook must answer fast)
  for (const prefix of PUBLIC_API_PATHS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return;
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
