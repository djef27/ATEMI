/**
 * Tests for SasPayPaymentProvider
 *
 * IMPORTANT: Tests mock all network calls. NO real API requests are made.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SasPayPaymentProvider, type SasPayConfig } from '@/lib/payment/providers/saspay';
import { createHmac } from 'crypto';

if (typeof Response === 'undefined') {
  class TestResponse {
    ok: boolean;
    status: number;
    constructor(private readonly body: string, init?: { status?: number }) {
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
    }
    async json(): Promise<unknown> {
      return JSON.parse(this.body);
    }
  }
  Object.defineProperty(globalThis, 'Response', {
    value: TestResponse,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<SasPayConfig> = {}): SasPayConfig {
  return {
    apiKey: 'sk_test_1234567890abcdef',
    webhookSecret: 'whsec_test_abcdef123456',
    baseUrl: 'https://api.saspay.me/api/v1',
    environment: 'sandbox',
    ...overrides,
  };
}

function makePayload(...lines: string[]): string {
  return JSON.stringify({ event: 'transaction.success', data: { id: 'evt_test', reference: 'TXN-0001', status: 'SUCCESS' } });
}

// Helper to create a mock fetch
function createMockFetch(response: Response | Promise<Response>): void {
  global.fetch = jest.fn().mockImplementation(
    () => Promise.resolve(response as unknown as Response)
  ) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SasPayPaymentProvider', () => {
  let provider: SasPayPaymentProvider;

  beforeEach(() => {
    provider = new SasPayPaymentProvider(makeConfig());
    // Reset fetch mock before each test
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session with required fields', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'sess_abc123',
          checkout_url: 'https://pay.saspay.me/checkout/xxx',
          amount: '5000.00',
          currency: 'XOF',
          status: 'PENDING',
          created_at: '2026-10-28T00:00:00Z',
        },
        code: 200,
      };

      createMockFetch(new Response(JSON.stringify(mockResponse), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await provider.createCheckoutSession({
        amount: 5000,
        description: 'Test order',
        customerEmail: 'client@test.com',
        customerName: 'Test Client',
      });

      expect(result.checkoutUrl).toContain('pay.saspay.me');
      expect(result.reference).toBe('sess_abc123');

      // Verify the request was made with correct auth
      expect(fetch).toHaveBeenCalledWith(
        'https://api.saspay.me/api/v1/checkout-sessions/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_1234567890abcdef',
          }),
        })
      );
    });

    it('should pass amount as decimal string', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'sess_xyz',
          checkout_url: 'https://pay.saspay.me/checkout/zzz',
          amount: '5000.00',
          status: 'PENDING',
        },
        code: 200,
      };

      createMockFetch(new Response(JSON.stringify(mockResponse), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }));

      await provider.createCheckoutSession({
        amount: 5000,
        description: 'Test',
        customerEmail: 'test@test.com',
        customerName: 'Test',
      });

      // The amount should be passed as "5000.00" string
      const body = ((global.fetch as jest.Mock).mock.calls[0][1] as { body: string }).body;
      const parsedBody = JSON.parse(body);
      expect(parsedBody.amount).toBe('5000.00');
      expect(parsedBody.currency).toBe('XOF');
    });

    it('should throw on API error', async () => {
      createMockFetch(new Response(JSON.stringify({ success: false, error: { code: 'invalid_request', message: 'Missing amount' } }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      }));

      await expect(
        provider.createCheckoutSession({
          amount: 0,
          description: 'Test',
          customerEmail: 'test@test.com',
          customerName: 'Test',
        })
      ).rejects.toThrow('Erreur SasPay initiation');
    });

    it('should throw when API key is missing', async () => {
      const providerWithoutKey = new SasPayPaymentProvider(makeConfig({ apiKey: '' }));
      await expect(
        providerWithoutKey.createCheckoutSession({
          amount: 5000,
          description: 'Test',
          customerEmail: 'test@test.com',
          customerName: 'Test',
        })
      ).rejects.toThrow('[SASPay] SASPay_API_KEY manquante');
    });
  });

  describe('getPaymentStatus', () => {
    it('should verify payment status from API', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'txn_abc123',
          reference: 'TXN-0001',
          status: 'SUCCESS',
          amount: '5000.00',
          currency: 'XOF',
          paid_at: '2026-10-28T12:00:00Z',
          created_at: '2026-10-28T10:00:00Z',
        },
        code: 200,
      };

      createMockFetch(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await provider.getPaymentStatus('TXN-0001');

      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('XOF');
      expect(result.paidAt).toBe('2026-10-28T12:00:00Z');
    });

    it('should return pending for non-SUCCESS status', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'txn_abc123',
          reference: 'TXN-0001',
          status: 'PENDING',
          amount: '5000.00',
          currency: 'XOF',
        },
        code: 200,
      };

      createMockFetch(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await provider.getPaymentStatus('TXN-0001');

      expect(result.status).toBe('pending');
    });

    it('should return failed for FAILED status', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'txn_abc123',
          reference: 'TXN-0001',
          status: 'FAILED',
          amount: '5000.00',
          currency: 'XOF',
        },
        code: 200,
      };

      createMockFetch(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await provider.getPaymentStatus('TXN-0001');

      expect(result.status).toBe('failed');
    });

    it('should return pending on 404', async () => {
      createMockFetch(new Response(null, { status: 404 }));

      const result = await provider.getPaymentStatus('UNKNOWN');

      expect(result.status).toBe('pending');
    });
  });

  describe('verifyWebhook', () => {
    it('should accept valid signature', async () => {
      // Generate expected signature: HMAC-SHA256 of timestamp.body
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"event":"transaction.success","data":{"id":"evt_test","reference":"TXN-0001"}}';
      const signed = `${timestamp}.${body}`;
      const expectedSignature = createHmac('sha256', 'whsec_test_abcdef123456').update(signed).digest('hex');

      const result = await provider.verifyWebhook(body, expectedSignature, timestamp);

      expect(result.valid).toBe(true);
    });

    it('should reject when signature is missing', async () => {
      const body = makePayload();
      const result = await provider.verifyWebhook(body, null, '1234567890');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature manquante');
    });

    it('should reject when timestamp is missing', async () => {
      const body = makePayload();
      const signed = `1234567890.${body}`;
      const expectedSignature = createHmac('sha256', 'whsec_test_abcdef123456').update(signed).digest('hex');

      const result = await provider.verifyWebhook(body, expectedSignature, null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp manquant');
    });

    it('should reject when timestamp is too old (> 5 min)', async () => {
      const body = makePayload();
      const oldTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const signed = `${oldTimestamp}.${body}`;
      const expectedSignature = createHmac('sha256', 'whsec_test_abcdef123456').update(signed).digest('hex');

      const result = await provider.verifyWebhook(body, expectedSignature, oldTimestamp.toString());

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp trop ancien');
    });

    it('should reject when signature does not match', async () => {
      const body = makePayload();
      const timestamp = Math.floor(Date.now() / 1000);
      const invalidSignature = '0'.repeat(64);
      const result = await provider.verifyWebhook(body, invalidSignature, timestamp.toString());

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature invalide');
    });

    it('should reject on malformed signature', async () => {
      const body = makePayload();
      const result = await provider.verifyWebhook(body, '', '1234567890');

      expect(result.valid).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse a valid webhook event', () => {
      const body = makePayload();
      const event = SasPayPaymentProvider.parseWebhookEvent(body);

      expect(event).not.toBeNull();
      expect(event!.event).toBe('transaction.success');
      expect(event!.data.reference).toBe('TXN-0001');
      expect(event!.data.id).toBe('evt_test');
    });

    it('should return null on malformed JSON', () => {
      const event = SasPayPaymentProvider.parseWebhookEvent('{invalid json');
      expect(event).toBeNull();
    });

    it('should return null when event or data is missing', () => {
      const missingData = SasPayPaymentProvider.parseWebhookEvent('{"event":"transaction.success"}');
      const missingEvent = SasPayPaymentProvider.parseWebhookEvent('{"data":{}}');
      expect(missingData).toBeNull();
      expect(missingEvent).toBeNull();
    });
  });

  describe('extractTransactionReference', () => {
    it('should extract reference from event data', () => {
      const data = { reference: 'TXN-0001', id: 'evt_001' };
      const result = SasPayPaymentProvider.extractTransactionReference(data);
      expect(result).toBe('TXN-0001');
    });

    it('should fall back to id when reference is missing', () => {
      const data = { id: 'evt_001' };
      const result = SasPayPaymentProvider.extractTransactionReference(data);
      expect(result).toBe('evt_001');
    });

    it('should return null when neither reference nor id exist', () => {
      const result = SasPayPaymentProvider.extractTransactionReference({});
      expect(result).toBeNull();
    });
  });

  describe('extractAmountCurrency', () => {
    it('should parse amount from string', () => {
      const data = { amount: '5000.00', currency: 'XOF' };
      const result = SasPayPaymentProvider.extractAmountCurrency(data);
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('XOF');
    });

    it('should handle amount as number', () => {
      const data = { amount: 5000, currency: 'XOF' };
      const result = SasPayPaymentProvider.extractAmountCurrency(data);
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('XOF');
    });

    it('should default currency to XOF when missing', () => {
      const data = { amount: '5000.00' };
      const result = SasPayPaymentProvider.extractAmountCurrency(data);
      expect(result.currency).toBe('XOF');
    });
  });
});
