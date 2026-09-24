import { paymentConfirmSchema, orderCreateSchema } from '@/lib/validations';

describe('Security: Input Validation', () => {
  describe('paymentConfirmSchema', () => {
    it('accepts valid payment confirmation', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_reference: 'TXN-12345-ABC',
        payment_method: 'mobile_money',
      });
      expect(result.success).toBe(true);
    });

    it('accepts null transaction_reference', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_reference: null,
        payment_method: 'cash',
      });
      expect(result.success).toBe(true);
    });

    it('accepts missing optional fields', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty payment_id', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects SQL injection in payment_id', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: "'; DROP TABLE payments; --",
      });
      expect(result.success).toBe(false);
    });

    it('rejects transaction_reference > 100 chars', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_reference: 'A'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('rejects transaction_reference with special chars', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_reference: '<script>alert("xss")</script>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects SQL injection in transaction_reference', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_reference: "1' OR '1'='1",
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid payment_method', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: '550e8400-e29b-41d4-a716-446655440000',
        payment_method: 'hacker_method',
      });
      expect(result.success).toBe(false);
    });

    it('rejects numeric payment_id', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: 12345,
      });
      expect(result.success).toBe(false);
    });

    it('rejects object as payment_id', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: { $ne: null },
      });
      expect(result.success).toBe(false);
    });

    it('rejects array as payment_id', () => {
      const result = paymentConfirmSchema.safeParse({
        payment_id: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('orderCreateSchema', () => {
    const validOrder = {
      p_customer_name: 'Jean Dupont',
      p_customer_phone: '+229 01 02 03 04',
      p_delivery_address: '123 Rue du Commerce',
      p_delivery_city: 'Cotonou',
      p_delivery_required: true,
      p_items: [
        { product_id: '550e8400-e29b-41d4-a716-446655440000', quantity: 2 },
      ],
    };

    it('accepts valid order', () => {
      const result = orderCreateSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it('rejects empty items array', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_items: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects quantity <= 0', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_items: [{ product_id: '550e8400-e29b-41d4-a716-446655440000', quantity: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative quantity', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_items: [{ product_id: '550e8400-e29b-41d4-a716-446655440000', quantity: -1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects quantity > 999', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_items: [{ product_id: '550e8400-e29b-41d4-a716-446655440000', quantity: 1000 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid product_id in items', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_items: [{ product_id: 'not-a-uuid', quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects customer_name too long', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_customer_name: 'A'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid phone format', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_customer_phone: 'not-a-phone!@#',
      });
      expect(result.success).toBe(false);
    });

    it('rejects customer_notes too long', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_customer_notes: 'A'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('rejects > 50 items', () => {
      const items = Array.from({ length: 51 }, (_, i) => ({
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 1,
      }));
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        p_items: items,
      });
      expect(result.success).toBe(false);
    });
  });
});
