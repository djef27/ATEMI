import fs from 'fs';
import path from 'path';

describe('Vendor order read policy role scope', () => {
  it('limits the helper-backed policy to authenticated users without changing its predicate', () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        'supabase/migrations/20261013100000_scope_orders_vendor_read_to_authenticated.sql'
      ),
      'utf-8'
    );

    expect(migration).toMatch(
      /CREATE POLICY "orders_vendor_read"\s+ON public\.orders\s+FOR SELECT\s+TO authenticated\s+USING\s*\([\s\S]*?vendor_id = public\.get_my_vendor_id\(\)[\s\S]*?OR public\.order_has_vendor_items\(id, public\.get_my_vendor_id\(\)\)[\s\S]*?\);/i
    );
  });
});
