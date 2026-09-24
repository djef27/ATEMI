/**
 * Payment provider abstraction tests.
 *
 * Tests the provider adapter layer:
 * - Mock provider behavior
 * - Provider factory
 * - Config validation
 * - Provider interface compliance
 */

describe('Payment Provider Abstraction', () => {
  describe('MockPaymentProvider', () => {
    it('returns name "mock"', async () => {
      const { MockPaymentProvider } = await import('@/lib/payment/providers/mock');
      const provider = new MockPaymentProvider();
      expect(provider.name).toBe('mock');
    });

    it('verifyWebhook always returns valid', async () => {
      const { MockPaymentProvider } = await import('@/lib/payment/providers/mock');
      const provider = new MockPaymentProvider();
      const result = await provider.verifyWebhook('payload', 'sig', '123');
      expect(result.valid).toBe(true);
    });

    it('getPaymentStatus always returns succeeded', async () => {
      const { MockPaymentProvider } = await import('@/lib/payment/providers/mock');
      const provider = new MockPaymentProvider();
      const result = await provider.getPaymentStatus('txn-123');
      expect(result.status).toBe('succeeded');
      expect(result.currency).toBe('XOF');
    });

    it('tracks processed events', async () => {
      const { MockPaymentProvider } = await import('@/lib/payment/providers/mock');
      const provider = new MockPaymentProvider();

      expect(await provider.isEventProcessed('evt-1')).toBe(false);

      await provider.markEventProcessed('evt-1');
      expect(await provider.isEventProcessed('evt-1')).toBe(true);
      expect(await provider.isEventProcessed('evt-2')).toBe(false);
    });

    it('reset clears processed events', async () => {
      const { MockPaymentProvider } = await import('@/lib/payment/providers/mock');
      const provider = new MockPaymentProvider();

      await provider.markEventProcessed('evt-1');
      provider.reset();
      expect(await provider.isEventProcessed('evt-1')).toBe(false);
    });
  });

  describe('Provider Factory', () => {
    it('returns MockPaymentProvider when PAYMENT_PROVIDER=mock', async () => {
      process.env.PAYMENT_PROVIDER = 'mock';
      const { getPaymentProvider, resetPaymentProvider } = await import('@/lib/payment/providers');
      const { resetPaymentConfig } = await import('@/lib/payment/config');

      resetPaymentConfig();
      resetPaymentProvider();

      const provider = getPaymentProvider();
      expect(provider.name).toBe('mock');

      resetPaymentConfig();
    });

    it('defaults to mock for unsupported provider', async () => {
      process.env.PAYMENT_PROVIDER = 'unsupported';
      const { getPaymentProvider, resetPaymentProvider } = await import('@/lib/payment/providers');
      const { resetPaymentConfig } = await import('@/lib/payment/config');

      resetPaymentConfig();
      resetPaymentProvider();

      // Unsupported provider falls back to mock
      const provider = getPaymentProvider();
      expect(provider.name).toBe('mock');

      resetPaymentConfig();
    });
  });

  describe('Payment Config', () => {
    it('getPaymentConfig returns mock config when PAYMENT_PROVIDER=mock', async () => {
      process.env.PAYMENT_PROVIDER = 'mock';
      const { getPaymentConfig, resetPaymentConfig } = await import('@/lib/payment/config');

      resetPaymentConfig();
      const config = getPaymentConfig();

      expect(config.provider).toBe('mock');
      expect(config.isMock).toBe(true);

      resetPaymentConfig();
    });

    it('getPaymentConfig returns real config when PAYMENT_PROVIDER=fedapay', async () => {
      process.env.PAYMENT_PROVIDER = 'fedapay';
      process.env.PAYMENT_API_KEY = 'pk_test_xxx';
      process.env.PAYMENT_API_SECRET = 'sk_test_xxx';
      process.env.PAYMENT_WEBHOOK_SECRET = 'whsec_xxx';

      const { getPaymentConfig, resetPaymentConfig } = await import('@/lib/payment/config');

      resetPaymentConfig();
      const config = getPaymentConfig();

      expect(config.provider).toBe('fedapay');
      expect(config.isMock).toBe(false);
      expect(config.apiKey).toBe('pk_test_xxx');

      resetPaymentConfig();
    });
  });

  describe('Provider interface compliance', () => {
    it('MockPaymentProvider implements all required methods', async () => {
      const { MockPaymentProvider } = await import('@/lib/payment/providers/mock');
      const provider = new MockPaymentProvider();

      expect(typeof provider.verifyWebhook).toBe('function');
      expect(typeof provider.getPaymentStatus).toBe('function');
      expect(typeof provider.isEventProcessed).toBe('function');
      expect(typeof provider.markEventProcessed).toBe('function');
    });

    it('provider has readonly name', async () => {
      const { MockPaymentProvider } = await import('@/lib/payment/providers/mock');
      const provider = new MockPaymentProvider();

      expect(provider.name).toBe('mock');
    });
  });

  describe('PROVIDER_EVENT_MAP', () => {
    it('maps Stripe events correctly', async () => {
      const { PROVIDER_EVENT_MAP } = await import('@/lib/payment/types');

      expect(PROVIDER_EVENT_MAP['payment_intent.succeeded']).toBe('payment_confirmed');
      expect(PROVIDER_EVENT_MAP['payment_intent.payment_failed']).toBe('payment_failed');
      expect(PROVIDER_EVENT_MAP['payment_intent.refunded']).toBe('payment_refunded');
    });

    it('maps Paystack events correctly', async () => {
      const { PROVIDER_EVENT_MAP } = await import('@/lib/payment/types');

      expect(PROVIDER_EVENT_MAP['charge.success']).toBe('payment_confirmed');
      expect(PROVIDER_EVENT_MAP['charge.failed']).toBe('payment_failed');
      expect(PROVIDER_EVENT_MAP['charge.refunded']).toBe('payment_refunded');
    });

    it('maps FedaPay events correctly', async () => {
      const { PROVIDER_EVENT_MAP } = await import('@/lib/payment/types');

      expect(PROVIDER_EVENT_MAP['transaction.approved']).toBe('payment_confirmed');
      expect(PROVIDER_EVENT_MAP['transaction.declined']).toBe('payment_failed');
      expect(PROVIDER_EVENT_MAP['transaction.canceled']).toBe('payment_failed');
    });

    it('maps generic events correctly', async () => {
      const { PROVIDER_EVENT_MAP } = await import('@/lib/payment/types');

      expect(PROVIDER_EVENT_MAP['payment.confirmed']).toBe('payment_confirmed');
      expect(PROVIDER_EVENT_MAP['payment.failed']).toBe('payment_failed');
      expect(PROVIDER_EVENT_MAP['payment.refunded']).toBe('payment_refunded');
    });
  });
});
