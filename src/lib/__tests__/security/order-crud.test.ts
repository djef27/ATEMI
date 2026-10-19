/**
 * Order Status CRUD Tests
 *
 * Covers the admin/vendor order status management added in the audit pass:
 * - Shared status lists (order-status.ts)
 * - Admin orders [id] route (detail + status change)
 * - Vendor orders [id] route (limited vendor transitions)
 * - Admin products [id] / categories [id] routes
 * - UI integration (admin + vendor tables use the select component)
 */

import {
  ADMIN_UPDATEABLE_STATUSES,
  VENDOR_UPDATEABLE_STATUSES,
  TERMINAL_STATUSES,
  isOrderStatusTerminal,
} from '@/lib/order-status';

describe('Order status logic', () => {
  it('exports separate admin and vendor lists', () => {
    expect(ADMIN_UPDATEABLE_STATUSES).toContain('confirmed');
    expect(ADMIN_UPDATEABLE_STATUSES).toContain('completed');
    expect(ADMIN_UPDATEABLE_STATUSES).toContain('cancelled');

    expect(VENDOR_UPDATEABLE_STATUSES).toEqual(
      expect.arrayContaining(['vendor_processing', 'ready_for_delivery'])
    );
  });

  it('vendor list never exposes admin-only transitions', () => {
    for (const s of VENDOR_UPDATEABLE_STATUSES) {
      expect(['assigned_to_driver', 'out_for_delivery', 'delivered', 'completed', 'cancelled']).not.toContain(s);
    }
  });

  it('pending_payment and failed are never directly updateable by hand', () => {
    expect(ADMIN_UPDATEABLE_STATUSES).not.toContain('pending_payment');
    expect(ADMIN_UPDATEABLE_STATUSES).not.toContain('failed');
    expect(VENDOR_UPDATEABLE_STATUSES).not.toContain('pending_payment');
  });

  it('marks terminal statuses', () => {
    for (const s of TERMINAL_STATUSES) {
      expect(isOrderStatusTerminal(s)).toBe(true);
    }
    expect(isOrderStatusTerminal('confirmed')).toBe(false);
    expect(isOrderStatusTerminal('vendor_processing')).toBe(false);
    expect(isOrderStatusTerminal('out_for_delivery')).toBe(false);
  });
});

describe('Admin orders [id] route', () => {
  const fs = require('fs');
  const path = require('path');
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/admin/orders/[id]/route.ts'),
    'utf-8'
  );

  it('exports GET / PATCH / PUT only', () => {
    expect(route).toContain('export const GET = withAdminAuth');
    expect(route).toContain('export const PATCH = withAdminAuth');
    expect(route).toContain('export async function PUT');
    expect(route).not.toContain('export async function DELETE');
  });

  it('validates status against ADMIN_UPDATEABLE_STATUSES', () => {
    expect(route).toContain('ADMIN_UPDATEABLE_STATUSES');
    expect(route).toContain('statut de commande invalide');
  });

  it('rejects same-status and terminal moves with 409', () => {
    expect(route).toContain('La commande a déjà ce statut');
    expect(route).toContain('status: 409');
    expect(route).toContain('Impossible de modifier une commande au statut terminal');
  });

  it('uses an optimistic lock on previous status', () => {
    expect(route).toContain(".eq('status', oldStatus)");
    expect(route).toContain('Commande modifiée pendant l');
  });

  it('logs status history with changer identity', () => {
    expect(route).toContain("from('order_status_history')");
    expect(route).toContain('old_status: oldStatus');
    expect(route).toContain('new_status: newStatus');
    expect(route).toContain('changed_by: userId');
  });

  it('restores stock when an order is cancelled', () => {
    expect(route).toContain("if (newStatus === 'cancelled')");
    expect(route).toContain("from('order_items')");
    expect(route).toContain('stockRestored');
  });

  it('sends a best-effort email on status change', () => {
    expect(route).toContain('orderStatusEmail');
    expect(route).toContain('sendEmail');
  });

  it('GET returns items, payments, history and delivery zone', () => {
    expect(route).toContain("from('order_items')");
    expect(route).toContain("from('payments')");
    expect(route).toContain("from('order_status_history')");
    expect(route).toContain("from('delivery_zones')");
    expect(route).toContain('delivery_zone_name');
  });
});

describe('Vendor orders [id] route', () => {
  const fs = require('fs');
  const path = require('path');
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/vendor/orders/[id]/route.ts'),
    'utf-8'
  );

  it('exports PATCH / PUT only', () => {
    expect(route).toContain('export async function PATCH');
    expect(route).toContain('export async function PUT');
    expect(route).not.toContain('export const GET');
  });

  it('validates against VENDOR_UPDATEABLE_STATUSES', () => {
    expect(route).toContain('VENDOR_UPDATEABLE_STATUSES');
    expect(route).toContain('statut de commande invalide');
  });

  it('blocks unpaid and terminal orders', () => {
    expect(route).toContain('oldStatus === \'pending_payment\'');
    expect(route).toContain('non payée');
    expect(route).toContain('isOrderStatusTerminal(oldStatus)');
  });

  it('enforces cross-vendor protection', () => {
    // Ownership must mirror the "orders_vendor_read" RLS predicate: a vendor
    // owns an order when orders.vendor_id matches OR when at least one
    // order_items row is theirs (orders.vendor_id is NULL for multi-vendor
    // baskets, so testing it alone would also reject legitimate vendors).
    expect(route).toContain("'order_has_vendor_items'");
    expect(route).toContain('p_order_id: id');
    expect(route).toContain('p_vendor_id: auth.vendorId');
    expect(route).toContain('Accès refusé');
    expect(route).toContain('status: 403');
    expect(route).toContain('ownsItems !== true');
  });

  it('bypasses the ownership check only for admins', () => {
    expect(route).toContain('if (!auth.isAdmin) {');
    expect(route).toContain('if (!auth.isAdmin && !auth.vendorId)');
  });

  it('does not select PII it never returns', () => {
    expect(route).not.toContain('customer_email');
    expect(route).not.toContain('customer_name');
    expect(route).not.toContain('tracking_token');
  });

  it('uses requireVendorAuth and origin check', () => {
    expect(route).toContain('requireVendorAuth');
    expect(route).toContain('isAllowedOrigin');
  });

  it('writes order_status_history', () => {
    expect(route).toContain("from('order_status_history')");
  });
});

describe('Admin products [id] route', () => {
  const fs = require('fs');
  const path = require('path');
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/admin/produits/[id]/route.ts'),
    'utf-8'
  );

  it('exports GET / PATCH / DELETE / PUT', () => {
    expect(route).toContain('export const GET = withAdminAuth');
    expect(route).toContain('export const PATCH = withAdminAuth');
    expect(route).toContain('export const DELETE = withAdminAuth');
    expect(route).toContain('export async function PUT');
  });

  it('applies slug uniqueness excluding the current product', () => {
    expect(route).toContain(".neq('id', id)");
    expect(route).toContain('Un produit avec ce nom existe déjà');
  });

  it('recomputes deposit amounts on price/rate change', () => {
    expect(route).toContain('computeDepositAmounts(price, rate)');
    expect(route).toContain('updates.deposit_rate');
    expect(route).toContain('updates.selling_price');
  });

  it('auto-handles stock transitions', () => {
    expect(route).toContain("'out_of_stock'");
  });

  it('soft deletes to trash', () => {
    expect(route).toContain('deleted_at: now');
    expect(route).toContain('corbeille');
  });
});

describe('Admin categories [id] route', () => {
  const fs = require('fs');
  const path = require('path');
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/admin/categories/[id]/route.ts'),
    'utf-8'
  );

  it('exports PATCH / DELETE / PUT', () => {
    expect(route).toContain('export const PATCH = withAdminAuth');
    expect(route).toContain('export const DELETE = withAdminAuth');
    expect(route).toContain('export async function PUT');
    expect(route).not.toContain('export const GET');
  });

  it('blocks deletion while active products reference the category', () => {
    expect(route).toContain('Catégorie utilisée par des produits actifs');
    expect(route).toContain("is('deleted_at', null)");
    expect(route).toContain('status: 409');
  });

  it('soft-deactivates instead of hard delete', () => {
    expect(route).toContain('is_active: false');
    expect(route).toContain('Catégorie désactivée');
  });

  it('checks slug uniqueness on rename', () => {
    expect(route).toContain(".neq('id', id)");
  });
});

describe('UI integration', () => {
  const fs = require('fs');
  const path = require('path');

  it('admin orders page uses shared statuses and select component', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src/app/admin/commandes/page.tsx'),
      'utf-8'
    );
    expect(page).toContain('import OrderStatusSelect');
    expect(page).toContain('ADMIN_UPDATEABLE_STATUSES');
  });

  it('vendor orders page uses shared statuses and select component', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src/app/vendor/commandes/page.tsx'),
      'utf-8'
    );
    expect(page).toContain('import OrderStatusSelect');
    expect(page).toContain('VENDOR_UPDATEABLE_STATUSES');
  });

  it('select component PATCHes the status endpoint', () => {
    const component = fs.readFileSync(
      path.join(process.cwd(), 'src/components/order-status-select.tsx'),
      'utf-8'
    );
    expect(component).toContain('method: \'PATCH\'');
    expect(component).toContain('useToast');
  });
});

describe('Duplicate order / payment protection', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (p: string) =>
    fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

  it('always derives an idempotency key on order creation', () => {
    const route = read('src/app/api/orders/route.ts');
    // The key must be derived even when the client sends no header, otherwise
    // a script or third-party page bypasses deduplication entirely.
    expect(route).toContain("getIdempotencyKey(request, 'order:create', data)");
    expect(route).not.toContain("request.headers.get('idempotency-key')");
  });

  it('blocks the replay race when a prior attempt stored no response', () => {
    const route = read('src/app/api/orders/route.ts');
    expect(route).toContain('if (!idempotencyResult.isNew) {');
    expect(route).toContain('déjà en cours de traitement');
    expect(route).toContain('status: 409');
  });

  it('stores the idempotency response before the confirmation email', () => {
    const route = read('src/app/api/orders/route.ts');
    const store = route.indexOf('storeIdempotencyResponse(idempotencyKey');
    const email = route.indexOf('sendEmail({');
    expect(store).toBeGreaterThan(-1);
    expect(email).toBeGreaterThan(-1);
    expect(store).toBeLessThan(email);
  });

  it('deduplicates payment initiation', () => {
    const route = read('src/app/api/payment/initiate/route.ts');
    expect(route).toContain("getIdempotencyKey(request, 'pay:initiate', parsed.data)");
    expect(route).toContain('checkIdempotencyKey');
    expect(route).toContain('storeIdempotencyResponse(idempotencyKey');
  });

  it('never lets a vendor page select every order column', () => {
    const page = read('src/app/vendor/commandes/page.tsx');
    const selectClause = page.match(/\.from\('orders'\)\s*\.select\(([^)]*)\)/)?.[1] ?? '';
    expect(selectClause).not.toContain('*');
    expect(selectClause).not.toContain('tracking_token');
    expect(selectClause).not.toContain('customer_email');
    expect(selectClause).not.toContain('customer_notes');
    expect(selectClause).not.toContain('customer_whatsapp');
    expect(selectClause).not.toContain('vendor_id');
    // Only what the page actually renders.
    for (const column of ['id', 'order_number', 'status', 'customer_name', 'created_at']) {
      expect(selectClause).toContain(column);
    }
  });
});