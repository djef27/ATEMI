import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { AuthError } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_TIMEOUT_MS = 2000;

async function withSessionTimeout<T>(task: PromiseLike<T>, fallback: T): Promise<T> {
  return await Promise.race([
    task,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), SESSION_TIMEOUT_MS)),
  ]);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const userResult = await withSessionTimeout(
      supabase.auth.getUser(),
      { data: { user: null }, error: new AuthError('Supabase session lookup timed out') }
    );
    user = userResult?.data?.user ?? null;
  } catch {
    user = null;
  }

  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    const profileResult = await withSessionTimeout<{ data: { role: string } | null; error: unknown }>(
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      { data: null, error: null }
    );
    const userData = profileResult?.data;

    if (!userData || userData.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  if (request.nextUrl.pathname.startsWith('/vendor')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    const profileResult = await withSessionTimeout<{ data: { role: string } | null; error: unknown }>(
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      { data: null, error: null }
    );
    const userData = profileResult?.data;

    if (!userData || (userData.role !== 'vendor' && userData.role !== 'admin')) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  if (request.nextUrl.pathname.startsWith('/driver')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    const profileResult = await withSessionTimeout<{ data: { role: string } | null; error: unknown }>(
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      { data: null, error: null }
    );
    const userData = profileResult?.data;

    if (!userData || (userData.role !== 'driver' && userData.role !== 'admin')) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  if (
    request.nextUrl.pathname.startsWith('/mon-compte') ||
    request.nextUrl.pathname.startsWith('/mes-commandes')
  ) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
