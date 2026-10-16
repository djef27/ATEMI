import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20261009190000_restrict_order_rpc_execution.sql'
);
const ordersRoutePath = path.join(process.cwd(), 'src/app/api/orders/route.ts');

describe('Order RPC execution privileges', () => {
  const migration = fs.readFileSync(migrationPath, 'utf-8');

  it('restricts stock-mutating order creation to the server service role', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.create_order\([\s\S]*?\) FROM PUBLIC, anon, authenticated;/i
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.create_order\([\s\S]*?\) TO service_role;/i
    );
    expect(migration).toMatch(/has_function_privilege\(\s*'anon'[\s\S]*?'public\.create_order/);
    expect(migration).toMatch(/has_function_privilege\(\s*'authenticated'[\s\S]*?'public\.create_order/);
  });

  it('preserves authenticated vendor-policy access without exposing the helper anonymously', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.order_has_vendor_items\(uuid, uuid\) FROM PUBLIC, anon;/i
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.order_has_vendor_items\(uuid, uuid\) TO authenticated, service_role;/i
    );
    expect(migration).toMatch(/has_function_privilege\('anon', 'public\.order_has_vendor_items/);
  });

  it('keeps get_my_vendor_id out of anonymous reach while vendor RLS policies still work', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_my_vendor_id\(\) FROM PUBLIC, anon;/i
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_my_vendor_id\(\) TO authenticated, service_role;/i
    );
    expect(migration).toMatch(/has_function_privilege\('public', 'public\.get_my_vendor_id/);
    expect(migration).toMatch(/has_function_privilege\('anon', 'public\.get_my_vendor_id/);
  });

  it('keeps guest checkout on the server-side admin RPC path', () => {
    const ordersRoute = fs.readFileSync(ordersRoutePath, 'utf-8');

    expect(ordersRoute).toMatch(/createAdminSupabaseClient\(\)/);
    expect(ordersRoute).toMatch(/\.rpc\('create_order'/);
  });
});
