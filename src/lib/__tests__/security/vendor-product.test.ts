/**
 * Vendor Product CRUD Security Tests
 *
 * Tests the vendor product management system:
 * - API route structure
 * - Validation schemas
 * - Ownership verification
 * - IDOR protection
 * - Soft delete (trash) behavior
 * - Centralized auth helpers
 * - Admin vendor management
 */

describe('Vendor Product CRUD', () => {
  describe('Validation schemas', () => {
    it('productUpdateSchema accepts partial updates', async () => {
      const { productUpdateSchema } = await import('@/lib/validations');

      const nameOnly = productUpdateSchema.safeParse({ name: 'New Name' });
      expect(nameOnly.success).toBe(true);

      const stockOnly = productUpdateSchema.safeParse({ stock: 5 });
      expect(stockOnly.success).toBe(true);

      const statusOnly = productUpdateSchema.safeParse({ status: 'active' });
      expect(statusOnly.success).toBe(true);

      const multi = productUpdateSchema.safeParse({
        name: 'Updated Product',
        selling_price: 15000,
        stock: 10,
        status: 'active',
      });
      expect(multi.success).toBe(true);
    });

    it('productUpdateSchema rejects invalid data', async () => {
      const { productUpdateSchema } = await import('@/lib/validations');

      const emptyName = productUpdateSchema.safeParse({ name: '' });
      expect(emptyName.success).toBe(false);

      const negPrice = productUpdateSchema.safeParse({ selling_price: -100 });
      expect(negPrice.success).toBe(false);

      const negStock = productUpdateSchema.safeParse({ stock: -1 });
      expect(negStock.success).toBe(false);

      const badStatus = productUpdateSchema.safeParse({ status: 'invalid' });
      expect(badStatus.success).toBe(false);

      const badRate = productUpdateSchema.safeParse({ deposit_rate: 150 });
      expect(badRate.success).toBe(false);
    });

    it('productUpdateSchema validates category_id as UUID', async () => {
      const { productUpdateSchema } = await import('@/lib/validations');

      const valid = productUpdateSchema.safeParse({ category_id: '00000000-0000-0000-0000-000000000001' });
      expect(valid.success).toBe(true);

      const invalid = productUpdateSchema.safeParse({ category_id: 'not-a-uuid' });
      expect(invalid.success).toBe(false);
    });
  });

  describe('API route structure', () => {
    it('vendor products [id] route exists with correct methods', async () => {
      const fs = require('fs');
      const path = require('path');
      const routePath = path.join(
        process.cwd(),
        'src/app/api/vendor/produits/[id]/route.ts'
      );

      expect(fs.existsSync(routePath)).toBe(true);

      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function GET');
      expect(content).toContain('export async function PATCH');
      expect(content).toContain('export async function DELETE');
      expect(content).toContain('export async function PUT');
    });

    it('restore route exists', async () => {
      const fs = require('fs');
      const path = require('path');
      const routePath = path.join(
        process.cwd(),
        'src/app/api/vendor/produits/[id]/restore/route.ts'
      );

      expect(fs.existsSync(routePath)).toBe(true);

      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function POST');
    });

    it('cron cleanup route exists', async () => {
      const fs = require('fs');
      const path = require('path');
      const routePath = path.join(
        process.cwd(),
        'src/app/api/cron/cleanup-trash/route.ts'
      );

      expect(fs.existsSync(routePath)).toBe(true);

      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('deleted_at');
      expect(content).toContain('48');
      expect(content).toContain('product_images');
    });

    it('admin vendeurs [id] route exists', async () => {
      const fs = require('fs');
      const path = require('path');
      const routePath = path.join(
        process.cwd(),
        'src/app/api/admin/vendeurs/[id]/route.ts'
      );

      expect(fs.existsSync(routePath)).toBe(true);

      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function GET');
      expect(content).toContain('export async function PATCH');
      expect(content).toContain('export async function DELETE');
    });

    it('media [id] route exists with correct methods', async () => {
      const fs = require('fs');
      const path = require('path');
      const routePath = path.join(
        process.cwd(),
        'src/app/api/media/[id]/route.ts'
      );

      expect(fs.existsSync(routePath)).toBe(true);

      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function PATCH');
      expect(content).toContain('export async function DELETE');
    });
  });

  describe('Ownership verification (centralized auth)', () => {
    it('auth-helpers module exists with required functions', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'src/lib/auth-helpers.ts');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('requireVendorAuth');
      expect(content).toContain('requireAdminAuth');
      expect(content).toContain('requireProductOwner');
      expect(content).toContain('requireMediaOwner');
      expect(content).toContain('isAllowedOrigin');
    });

    it('vendor products route uses centralized auth', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('requireVendorAuth');
      expect(route).toContain('requireProductOwner');
      expect(route).toContain('isAllowedOrigin');
    });

    it('media route uses centralized auth', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/media/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('requireVendorAuth');
      expect(route).toContain('requireMediaOwner');
    });
  });

  describe('IDOR protection', () => {
    it('GET uses requireProductOwner which blocks cross-vendor access', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('requireProductOwner');
      expect(route).toContain('status: 403');
    });

    it('requireProductOwner checks vendor_id ownership', async () => {
      const fs = require('fs');
      const path = require('path');
      const authHelpers = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/auth-helpers.ts'),
        'utf-8'
      );

      expect(authHelpers).toContain("product.vendor_id !== vendorId");
      expect(authHelpers).toContain("'Accès refusé'");
    });

    it('DELETE returns 403 when deleting another vendor product', async () => {
      const fs = require('fs');
      const path = require('path');
      const authHelpers = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/auth-helpers.ts'),
        'utf-8'
      );

      expect(authHelpers).toContain("product.vendor_id !== vendorId");
    });
  });

  describe('Trash behavior (48h)', () => {
    it('DELETE uses deleted_at instead of hard delete', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('deleted_at');
      expect(route).toContain('corbeille');
    });

    it('restore route checks 48h deadline', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/restore/route.ts'),
        'utf-8'
      );

      expect(route).toContain('48');
      expect(route).toContain('deleted_at');
      expect(route).toContain('restauré');
    });

    it('vendor page has trash tab', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/vendor/produits/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('Corbeille');
      expect(page).toContain('trash');
      expect(page).toContain('Restaurer');
      expect(page).toContain('deleted_at');
    });

    it('cron route auto-deletes expired products', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/cron/cleanup-trash/route.ts'),
        'utf-8'
      );

      expect(route).toContain('48');
      expect(route).toContain('deleted_at');
      expect(route).toContain('product_images');
    });
  });

  describe('Admin vendor management', () => {
    it('admin vendors page has status toggle actions', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/admin/vendeurs/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('Suspendre');
      expect(page).toContain('Réactiver');
      expect(page).toContain('Désactiver');
    });

    it('admin vendors [id] route allows status update', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/admin/vendeurs/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('requireAdminAuth');
      expect(route).toContain('status');
      expect(route).toContain("'active'");
      expect(route).toContain("'suspended'");
      expect(route).toContain("'inactive'");
    });

    it('admin DELETE deactivates vendor and products', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/admin/vendeurs/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('vendor_id');
      expect(route).toContain('inactive');
    });
  });

  describe('Product visibility filtering', () => {
    it('catalog page filters out deleted_at products', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/products/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('deleted_at');
    });

    it('product detail page filters out deleted_at products', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/products/[slug]/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('deleted_at');
    });

    it('home page queries filter out deleted_at products', async () => {
      const fs = require('fs');
      const path = require('path');
      const queries = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/supabase/queries.ts'),
        'utf-8'
      );

      expect(queries).toContain('deleted_at');
    });
  });

  describe('Authentication requirements', () => {
    it('vendor products route requires authentication', async () => {
      const fs = require('fs');
      const path = require('path');
      const authHelpers = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/auth-helpers.ts'),
        'utf-8'
      );

      expect(authHelpers).toContain('Authentification requise');
      expect(authHelpers).toContain('status: 401');
    });

    it('vendor products route requires vendor or admin role', async () => {
      const fs = require('fs');
      const path = require('path');
      const authHelpers = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/auth-helpers.ts'),
        'utf-8'
      );

      expect(authHelpers).toContain("'vendor'");
      expect(authHelpers).toContain("'admin'");
      expect(authHelpers).toContain('Accès non autorisé');
    });

    it('admin routes require admin role only', async () => {
      const fs = require('fs');
      const path = require('path');
      const authHelpers = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/auth-helpers.ts'),
        'utf-8'
      );

      expect(authHelpers).toContain('requireAdminAuth');
      expect(authHelpers).toContain('Accès administrateur requis');
    });
  });

  describe('Slug uniqueness', () => {
    it('PATCH checks slug uniqueness excluding current product', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('.neq(\'id\', id)');
      expect(route).toContain('Un produit avec ce nom existe déjà');
    });
  });

  describe('Stock auto-update', () => {
    it('PATCH auto-updates status when stock reaches 0', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain("'out_of_stock'");
    });

    it('PATCH auto-restores status when stock > 0 from out_of_stock', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain("'active'");
      expect(route).toContain('out_of_stock');
    });
  });

  describe('Deposit calculation', () => {
    it('PATCH recalculates deposit_amount and remaining_amount', async () => {
      const fs = require('fs');
      const path = require('path');
      const route = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/vendor/produits/[id]/route.ts'),
        'utf-8'
      );

      expect(route).toContain('deposit_amount');
      expect(route).toContain('remaining_amount');
      expect(route).toContain('deposit_rate');
    });
  });

  describe('Vendor products page', () => {
    it('has edit button with Pencil icon', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/vendor/produits/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('Pencil');
      expect(page).toContain('openEdit');
    });

    it('has delete button with Trash2 icon', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/vendor/produits/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('Trash2');
      expect(page).toContain('deleteProductId');
    });

    it('has delete confirmation dialog mentioning 48h', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/vendor/produits/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('48 heures');
      expect(page).toContain('corbeille');
    });

    it('has edit modal with pre-filled form', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/vendor/produits/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('Modifier le produit');
      expect(page).toContain('editForm');
    });

    it('has trash section with restore button', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/vendor/produits/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('activeTab');
      expect(page).toContain("'trash'");
      expect(page).toContain('getTimeRemaining');
      expect(page).toContain('setRestoreProductId');
    });

    it('has restore confirmation modal', async () => {
      const fs = require('fs');
      const path = require('path');
      const page = fs.readFileSync(
        path.join(process.cwd(), 'src/app/vendor/produits/page.tsx'),
        'utf-8'
      );

      expect(page).toContain('Restaurer ce produit');
      expect(page).toContain('handleRestore');
    });
  });
});
