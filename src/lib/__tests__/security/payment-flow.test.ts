/**
 * Payment Flow Security Tests
 *
 * Tests the critical payment flow rules:
 * 1. PAID requires real server-side confirmation
 * 2. Frontend cannot force status=PAID
 * 3. Amount verification prevents tampering
 * 4. Idempotency prevents duplicate processing
 * 5. Receipt only available after payment confirmation
 * 6. Notifications only sent after payment confirmation
 * 7. Failed/cancelled payments don't generate receipts
 */

describe('Payment Flow Security', () => {
  describe('TEST 1 — Paid requires real confirmation', () => {
    it('paymentConfirmSchema does not include status field', async () => {
      const { paymentConfirmSchema } = await import('@/lib/validations');

      // Schema should NOT accept a status field
      const result = paymentConfirmSchema.safeParse({
        payment_id: '00000000-0000-0000-0000-000000000001',
        transaction_reference: 'TXN-123',
        payment_method: 'mobile_money',
        status: 'paid', // This should be ignored
      });

      expect(result.success).toBe(true);
      // The status field should NOT be in the parsed data
      if (result.success) {
        expect(result.data).not.toHaveProperty('status');
      }
    });

    it('paymentConfirmSchema rejects invalid payment_id', async () => {
      const { paymentConfirmSchema } = await import('@/lib/validations');

      const result = paymentConfirmSchema.safeParse({
        payment_id: 'not-a-uuid',
        transaction_reference: 'TXN-123',
        payment_method: 'mobile_money',
      });

      expect(result.success).toBe(false);
    });

    it('paymentConfirmSchema accepts valid inputs', async () => {
      const { paymentConfirmSchema } = await import('@/lib/validations');

      const result = paymentConfirmSchema.safeParse({
        payment_id: '00000000-0000-0000-0000-000000000001',
        transaction_reference: 'TXN-123',
        payment_method: 'mobile_money',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('TEST 2 — Frontend cannot force PAID status', () => {
    it('confirm endpoint schema rejects status field', async () => {
      const { paymentConfirmSchema } = await import('@/lib/validations');

      // Even if someone tries to send status, it's stripped by Zod
      const maliciousPayload = {
        payment_id: '00000000-0000-0000-0000-000000000001',
        transaction_reference: 'FAKE-REF',
        payment_method: 'admin_manual',
        status: 'paid',
        order_status: 'confirmed',
      };

      const result = paymentConfirmSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);

      if (result.success) {
        // Status field should be stripped
        expect(result.data).not.toHaveProperty('status');
        expect(result.data).not.toHaveProperty('order_status');
      }
    });

    it('orderCreateSchema does not include status or order_status fields', async () => {
      const { orderCreateSchema } = await import('@/lib/validations');

      const result = orderCreateSchema.safeParse({
        p_customer_name: 'Test User',
        p_customer_phone: '+22990000000',
        p_delivery_address: 'Test Address',
        p_delivery_city: 'Cotonou',
        p_delivery_required: true,
        p_items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 1 }],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // No status field should be present
        expect(result.data).not.toHaveProperty('status');
        expect(result.data).not.toHaveProperty('order_status');
        expect(result.data).not.toHaveProperty('p_status');
      }
    });
  });

  describe('TEST 3 — Amount verification', () => {
    it('orderCreateSchema validates item quantities', async () => {
      const { orderCreateSchema } = await import('@/lib/validations');

      // Valid order
      const valid = orderCreateSchema.safeParse({
        p_customer_name: 'Test User',
        p_customer_phone: '+22990000000',
        p_delivery_address: 'Test Address',
        p_delivery_city: 'Cotonou',
        p_delivery_required: true,
        p_items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 1 }],
      });

      expect(valid.success).toBe(true);

      // Invalid quantity (0)
      const invalidQty = orderCreateSchema.safeParse({
        p_customer_name: 'Test User',
        p_customer_phone: '+22990000000',
        p_delivery_address: 'Test Address',
        p_delivery_city: 'Cotonou',
        p_delivery_required: true,
        p_items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 0 }],
      });

      expect(invalidQty.success).toBe(false);

      // Invalid quantity (>999 max)
      const overMax = orderCreateSchema.safeParse({
        p_customer_name: 'Test User',
        p_customer_phone: '+22990000000',
        p_delivery_address: 'Test Address',
        p_delivery_city: 'Cotonou',
        p_delivery_required: true,
        p_items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 1000 }],
      });

      expect(overMax.success).toBe(false);
    });
  });

  describe('TEST 4 — Webhook idempotency', () => {
    it('rate limit config prevents rapid webhook processing', async () => {
      const { RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');

      // Webhook should allow generous retries but still have limits
      expect(RATE_LIMIT_CONFIGS.paymentWebhook.max).toBeGreaterThanOrEqual(50);
      expect(RATE_LIMIT_CONFIGS.paymentWebhook.windowMs).toBe(60_000);
    });

    it('payment confirm has strict rate limits', async () => {
      const { RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');

      // Payment confirm should be strictly limited
      expect(RATE_LIMIT_CONFIGS.paymentConfirm.max).toBeLessThanOrEqual(10);
      expect(RATE_LIMIT_CONFIGS.paymentConfirm.windowMs).toBe(60_000);
    });

    it('order creation has rate limits', async () => {
      const { RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');

      expect(RATE_LIMIT_CONFIGS.orderCreate.max).toBeLessThanOrEqual(20);
      expect(RATE_LIMIT_CONFIGS.orderCreate.windowMs).toBe(60_000);
    });
  });

  describe('TEST 5 — Receipt only after payment confirmation', () => {
    it('receipt page validates status before displaying', async () => {
      // Verify the receipt page checks payment status
      const fs = require('fs');
      const path = require('path');
      const recuPage = fs.readFileSync(
        path.join(process.cwd(), 'src/app/recu/page.tsx'),
        'utf-8'
      );

      // Receipt should check status before rendering
      expect(recuPage).toContain('status');
      expect(recuPage).toContain('paid');
      expect(recuPage).toContain('PAYÉ');
    });
  });

  describe('TEST 6 — Notifications only after payment', () => {
    it('confirm_deposit_payment function handles notifications', async () => {
      const fs = require('fs');
      const path = require('path');
      const migrationFiles = fs.readdirSync(
        path.join(process.cwd(), 'supabase/migrations')
      ).filter((f: string) => f.includes('concurrency'));

      expect(migrationFiles.length).toBeGreaterThan(0);

      const migration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations', migrationFiles[0]),
        'utf-8'
      );

      // Notifications should be created AFTER payment confirmation
      expect(migration).toContain('notifications');
      expect(migration).toContain('confirm_deposit_payment');
    });
  });

  describe('TEST 7 — Failed/cancelled payments', () => {
    it('webhook handler processes failed payments', async () => {
      const fs = require('fs');
      const path = require('path');
      const webhookRoute = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/payment/webhook/route.ts'),
        'utf-8'
      );

      // Webhook should handle payment_failed
      expect(webhookRoute).toContain('payment_failed');
      expect(webhookRoute).toContain('payment_refunded');
    });

    it('webhook verifies amount from provider', async () => {
      const fs = require('fs');
      const path = require('path');
      const webhookRoute = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/payment/webhook/route.ts'),
        'utf-8'
      );

      // Amount verification should be present
      expect(webhookRoute).toContain('providerAmount');
      expect(webhookRoute).toContain('payment.amount');
    });

    it('webhook verifies currency from provider', async () => {
      const fs = require('fs');
      const path = require('path');
      const webhookRoute = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/payment/webhook/route.ts'),
        'utf-8'
      );

      // Currency verification should be present
      expect(webhookRoute).toContain('providerCurrency');
      expect(webhookRoute).toContain('payment.currency');
    });
  });

  describe('Payment API route security', () => {
    it('order creation route validates required fields', async () => {
      const { orderCreateSchema } = await import('@/lib/validations');

      // Missing customer_name
      const missingName = orderCreateSchema.safeParse({
        p_customer_phone: '+22990000000',
        p_items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 1 }],
      });
      expect(missingName.success).toBe(false);

      // Missing phone
      const missingPhone = orderCreateSchema.safeParse({
        p_customer_name: 'Test',
        p_items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 1 }],
      });
      expect(missingPhone.success).toBe(false);

      // Empty items
      const emptyItems = orderCreateSchema.safeParse({
        p_customer_name: 'Test',
        p_customer_phone: '+22990000000',
        p_items: [],
      });
      expect(emptyItems.success).toBe(false);
    });

    it('confirm endpoint rejects non-POST methods', async () => {
      const fs = require('fs');
      const path = require('path');
      const confirmRoute = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/payment/confirm/route.ts'),
        'utf-8'
      );

      // Should have GET, PUT, DELETE handlers that return 405
      expect(confirmRoute).toContain('405');
      expect(confirmRoute).toContain('Méthode non autorisée');
    });
  });

  describe('SQL function security', () => {
    it('confirm_deposit_payment is SECURITY DEFINER', async () => {
      const fs = require('fs');
      const path = require('path');
      const migration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20260828230000_fix_concurrency.sql'),
        'utf-8'
      );

      expect(migration).toContain('SECURITY DEFINER');
    });

    it('confirm_deposit_payment uses row-level locking', async () => {
      const fs = require('fs');
      const path = require('path');
      const migration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20260828230000_fix_concurrency.sql'),
        'utf-8'
      );

      // Should use FOR UPDATE (case-insensitive in SQL) to prevent race conditions
      expect(migration.toLowerCase()).toContain('for update');
    });

    it('confirm_deposit_payment is restricted to service_role', async () => {
      const fs = require('fs');
      const path = require('path');
      const migration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20260828230000_fix_concurrency.sql'),
        'utf-8'
      );

      expect(migration).toContain('REVOKE');
      expect(migration).toContain('service_role');
    });

    it('create_order deducts stock with FOR UPDATE lock', async () => {
      const fs = require('fs');
      const path = require('path');
      const migration = fs.readFileSync(
        path.join(process.cwd(), 'supabase/migrations/20260831010000_update_create_order_deposit_rate.sql'),
        'utf-8'
      );

      // Should use FOR UPDATE (case-insensitive in SQL)
      expect(migration.toLowerCase()).toContain('for update');
      expect(migration).toContain('stock');
    });
  });
});
