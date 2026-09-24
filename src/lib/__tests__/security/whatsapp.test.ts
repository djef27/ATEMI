/**
 * WhatsApp abstraction tests.
 *
 * Tests the WhatsApp notification layer:
 * - Mock provider behavior
 * - Message formatting
 * - Provider configuration
 */

describe('WhatsApp Abstraction', () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_API_URL;
  });

  describe('Mock WhatsApp', () => {
    it('sendWhatsAppMessage returns success in mock mode', async () => {
      process.env.WHATSAPP_PROVIDER = 'mock';
      const { sendWhatsAppMessage } = await import('@/lib/whatsapp');

      const result = await sendWhatsAppMessage('+22990000000', 'Test message');
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^mock_/);
    });

    it('sendWhatsAppMessage fails when destination is missing', async () => {
      process.env.WHATSAPP_PROVIDER = 'mock';
      const { sendWhatsAppMessage } = await import('@/lib/whatsapp');

      const result = await sendWhatsAppMessage('', 'Test message');
      expect(result.success).toBe(false);
      expect(result.error).toContain('manquant');
    });
  });

  describe('Provider name', () => {
    it('getWhatsAppProviderName returns mock by default', async () => {
      process.env.WHATSAPP_PROVIDER = '';
      const { getWhatsAppProviderName } = await import('@/lib/whatsapp');
      expect(getWhatsAppProviderName()).toBe('mock');
    });

    it('getWhatsAppProviderName returns mock for unknown provider', async () => {
      process.env.WHATSAPP_PROVIDER = 'twilio';
      const { getWhatsAppProviderName } = await import('@/lib/whatsapp');
      expect(getWhatsAppProviderName()).toBe('mock');
    });

    it('getWhatsAppProviderName returns meta when configured', async () => {
      process.env.WHATSAPP_PROVIDER = 'meta';
      const { getWhatsAppProviderName } = await import('@/lib/whatsapp');
      expect(getWhatsAppProviderName()).toBe('meta');
    });
  });

  describe('validateWhatsAppConfig', () => {
    it('returns null for mock provider', async () => {
      process.env.WHATSAPP_PROVIDER = 'mock';
      const { validateWhatsAppConfig } = await import('@/lib/whatsapp');
      expect(validateWhatsAppConfig()).toBeNull();
    });

    it('returns error when meta URL is missing', async () => {
      process.env.WHATSAPP_PROVIDER = 'meta';
      delete process.env.WHATSAPP_API_URL;
      const { validateWhatsAppConfig } = await import('@/lib/whatsapp');
      expect(validateWhatsAppConfig()).toContain('WHATSAPP_API_URL manquant');
    });

    it('returns error when meta token is missing', async () => {
      process.env.WHATSAPP_PROVIDER = 'meta';
      process.env.WHATSAPP_API_URL = 'https://graph.facebook.com/v25.0/123/messages';
      const { validateWhatsAppConfig } = await import('@/lib/whatsapp');
      expect(validateWhatsAppConfig()).toContain('WHATSAPP_API_TOKEN manquant');
    });

    it('returns null when meta is fully configured', async () => {
      process.env.WHATSAPP_PROVIDER = 'meta';
      process.env.WHATSAPP_API_URL = 'https://graph.facebook.com/v25.0/123/messages';
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      const { validateWhatsAppConfig } = await import('@/lib/whatsapp');
      expect(validateWhatsAppConfig()).toBeNull();
    });
  });

  describe('Order notifications', () => {
    it('sendOrderNotification returns success for vendor notification', async () => {
      process.env.WHATSAPP_PROVIDER = 'mock';
      const { sendOrderNotification } = await import('@/lib/whatsapp');

      const result = await sendOrderNotification('+22990000000', 'new_order_vendor', {
        order_number: 'ATM-001',
        customer_name: 'Test',
        customer_phone: '+22990000000',
        products: '• Product × 1 — 10,000 FCFA\n',
        delivery_city: 'Cotonou',
        delivery_required: true,
        delivery_address: '123 Test St',
        delivery_balance: '5,000',
      });

      expect(result.success).toBe(true);
    });

    it('sendOrderNotification returns success for admin notification', async () => {
      process.env.WHATSAPP_PROVIDER = 'mock';
      const { sendOrderNotification } = await import('@/lib/whatsapp');

      const result = await sendOrderNotification('+22990000000', 'new_order_admin', {
        order_number: 'ATM-001',
        customer_name: 'Test',
        customer_phone: '+22990000000',
        products: '• Product × 1 — 10,000 FCFA\n',
        subtotal: '10,000',
        delivery_fee: '2,000',
        total_amount: '12,000',
        deposit_amount: '6,000',
        delivery_balance: '6,000',
        delivery_city: 'Cotonou',
        delivery_required: true,
        delivery_address: '123 Test St',
      });

      expect(result.success).toBe(true);
    });

    it('sendOrderNotification returns success for customer notification', async () => {
      process.env.WHATSAPP_PROVIDER = 'mock';
      const { sendOrderNotification } = await import('@/lib/whatsapp');

      const result = await sendOrderNotification('+22990000000', 'new_order_customer', {
        order_number: 'ATM-001',
        customer_name: 'Test',
        products: '• Product × 1 — 10,000 FCFA\n',
        subtotal: '10,000',
        delivery_fee: '2,000',
        total_amount: '12,000',
        deposit_amount: '6,000',
        delivery_balance: '6,000',
        receipt_number: 'ATEMI-20260907-001',
        tracking_link: 'https://atemi.example/recu',
      });

      expect(result.success).toBe(true);
    });

    it('sendOrderNotification fails for unsupported notification type', async () => {
      process.env.WHATSAPP_PROVIDER = 'mock';
      const { sendOrderNotification } = await import('@/lib/whatsapp');

      const result = await sendOrderNotification('+22990000000', 'unknown' as never, {
        order_number: 'ATM-001',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('non supporté');
    });
  });
});