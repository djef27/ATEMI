import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Keep static rendering and preview builds functional when public Supabase
  // variables have not been configured yet. Runtime pages must configure the
  // real variables before authentication or database features are used.
  return createBrowserClient(
    url || 'https://placeholder.supabase.co',
    anonKey || 'placeholder-anon-key'
  );
}
