import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return { url, anonKey, serviceRoleKey };
}

function assertSupabaseReady({ url, anonKey }: { url?: string; anonKey?: string }) {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Unsupported Supabase protocol: ${parsed.protocol}`);
    }
    if (!parsed.hostname) {
      throw new Error('Supabase URL is missing a hostname.');
    }
  } catch {
    throw new Error(`Supabase URL is invalid or malformed: ${url}`);
  }
}

export async function createPublicServerSupabaseClient() {
  const config = getSupabaseConfig();
  assertSupabaseReady(config);

  return createServerClient(config.url!, config.anonKey!, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Public reads do not need request cookies.
      },
    },
  });
}

export async function createServerSupabaseClient() {
  const config = getSupabaseConfig();
  assertSupabaseReady(config);

  const cookieStore = await cookies();

  return createServerClient(config.url!, config.anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/** Admin client with service role key — use only in server-side code */
export function createAdminSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client is unavailable. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.'
    );
  }

  // Do not bind the service-role client to request cookies. Doing so can
  // replace the service-role authorization with the user's JWT.
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
