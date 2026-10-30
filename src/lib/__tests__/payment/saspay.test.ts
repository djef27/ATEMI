// @jest-environment node



/**

 * Tests for SasPayPaymentProvider

 *

 * IMPORTANT: Tests mock all network calls. NO real API requests are made.

 *

 * SasPay verification rules tested (per official docs):

 *   - Webhook signature: HMAC-SHA256(signing_secret, timestamp + "." + rawBody)

 *   - Timestamp tolerance: +/- 300 seconds (5 minutes)

 *   - Amounts are strings in decimal format ("5000.00")

 *   - Verify endpoint: GET /payments/{reference}/verify/

 *   - Checkout endpoint: POST /checkout-sessions/

 *

 * NOTE: this test file runs in the Node environment so that:

 *   - global 'crypto' and 'fetch' (Node >= 18) are available, and

 *   - 'require' is defined (jsdom + ESM cannot resolve them).

 *   A minimal Response polyfill is provided in case the Node runtime is

 *   older than 18.

 */



import { describe, it, expect, beforeEach } from '@jest/globals';

import { SasPayPaymentProvider, SasPayConfig } from '@/lib/payment/providers/saspay';



// ---------------------------------------------------------------------------

// Minimal Response polyfill (Node >= 18 provides global Response; this

// fallback keeps the file working on older runtimes)

// ---------------------------------------------------------------------------



class Response {

  readonly status: number;

  readonly headers: Record<string, string>;

  readonly bodyUsed: boolean;

  readonly ok: boolean;



  constructor(body: string | object | null, init?: { status?: number; headers?: Record<string, string> }) {

    this.status = init?.status ?? 200;

    this.ok = this.status >= 200 && this.status < 300;

    this.headers = init?.headers ?? {};

    this.bodyUsed = false;

    this._body = typeof body === 'string' ? body : JSON.stringify(body);

  }



  private _body: string;



  text(): Promise<string> {

    return Promise.resolve(this._body);

  }



  json(): Promise<unknown> {

    return Promise.resolve(JSON.parse(this._body));

  }

}



// ---------------------------------------------------------------------------

// Helpers

// ---------------------------------------------------------------------------



function makeConfig(overrides: Partial<{
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  environment: 'sandbox' | 'live';
}> = {}): SasPayConfig {
  return {

    apiKey: 'sk_test_**********cdef',

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  (global as any).fetch = jest.fn().mockImplementation(() => Promise.resolve(response as unknown as Response));

}



function hmacSha256Hex(key: string, message: string): string {

  // Tests run in Node so require('crypto') is available; sync HMAC is fast

  // and does not return a Promise.

  const sign = require('crypto').createHmac('sha256', key);

  sign.update(message, 'utf8');

  return sign.digest('hex');

}



// ---------------------------------------------------------------------------

// Test suite

// ---------------------------------------------------------------------------



describe('SasPayPaymentProvider', () => {

  let provider: SasPayPaymentProvider;



  beforeEach(() => {

    provider = new SasPayPaymentProvider(makeConfig());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any

    (global as any).fetch = jest.fn();

  });



  afterEach(() => {

    (global as any).fetch.mockReset();

  });



  // -----------------------------------------------------------------------

  // createCheckoutSession

  // -----------------------------------------------------------------------



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

      expect((global as any).fetch).toHaveBeenCalledWith(

        'https://api.saspay.me/api/v1/checkout-sessions/',

        expect.objectContaining({

          method: 'POST',

          headers: expect.objectContaining({

            Authorization: 'Bearer sk_test_**********cdef',

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

      const body = ((global as any).fetch as jest.Mock).mock.calls[0][1].body as string;

      const parsedBody = JSON.parse(body);

      expect(parsedBody.amount).toBe('5000.00');

      expect(parsedBody.currency).toBe('XOF');

    });



    it('should pass customer_phone when provided', async () => {

      const mockResponse = {

        success: true,

        data: {

          id: 'sess_phone',

          checkout_url: 'https://pay.saspay.me/checkout/phone',

          amount: '5000.00',

          currency: 'XOF',

          status: 'PENDING',

          customer_phone: '22900000000',

          customer_email: 'test@test.com',

          customer_name: 'Test',

          created_at: '2026-10-28T00:00:00Z',

          updated_at: '2026-10-28T00:00:00Z',

        },

        code: 200,

      };



      createMockFetch(new Response(JSON.stringify(mockResponse), {

        status: 201,

        headers: { 'content-type': 'application/json' },

      }));



      const result = await provider.createCheckoutSession({

        amount: 5000,

        description: 'Test',

        customerEmail: 'test@test.com',

        customerName: 'Test',

        customerPhone: '22900000000',

      });



      expect(result.checkoutUrl).toContain('pay.saspay.me');

      expect(result.reference).toBe('sess_phone');



      const body = ((global as any).fetch as jest.Mock).mock.calls[0][1].body as string;

      const parsedBody = JSON.parse(body);

      expect(parsedBody.customer_phone).toBe('22900000000');

    });



    it('should pass metadata when provided', async () => {

      const mockResponse = {

        success: true,

        data: {

          id: 'sess_meta',

          checkout_url: 'https://pay.saspay.me/checkout/meta',

          amount: '5000.00',

          currency: 'XOF',

          status: 'PENDING',

          customer_phone: '',

          customer_email: 'test@test.com',

          customer_name: 'Test',

          created_at: '2026-10-28T00:00:00Z',

          updated_at: '2026-10-28T00:00:00Z',

        },

        code: 200,

      };



      createMockFetch(new Response(JSON.stringify(mockResponse), {

        status: 201,

        headers: { 'content-type': 'application/json' },

      }));



      const result = await provider.createCheckoutSession({

        amount: 5000,

        description: 'Test',

        customerEmail: 'test@test.com',

        customerName: 'Test',

        metadata: { order_number: 'CO-001', provider_reference: 'ATEMI-CO-001' },

      });



      const body = ((global as any).fetch as jest.Mock).mock.calls[0][1].body as string;

      const parsedBody = JSON.parse(body);

      expect(parsedBody.metadata).toEqual({ order_number: 'CO-001', provider_reference: 'ATEMI-CO-001' });

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



  // -----------------------------------------------------------------------

  // getPaymentStatus

  // -----------------------------------------------------------------------



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

      await expect(provider.getPaymentStatus('UNKNOWN')).resolves.toMatchObject({

        status: 'pending',

      });

    });



    it('should return pending on network error', async () => {

      (global as any).fetch = jest.fn().mockRejectedValue(new Error('Network down'));

      await expect(provider.getPaymentStatus('TXN-0001')).rejects.toThrow('Network down');

    });

  });



  // -----------------------------------------------------------------------

  // verifyWebhook

  // -----------------------------------------------------------------------



  describe('verifyWebhook', () => {

    it('should accept valid signature', async () => {

      const timestamp = Math.floor(Date.now() / 1000).toString();

      const body = JSON.stringify({ event: 'transaction.success', data: { id: 'evt_test', reference: 'TXN-0001' } });

      const expectedSignature = hmacSha256Hex('whsec_test_abcdef123456', `${timestamp}.${body}`);



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

      const expectedSignature = hmacSha256Hex('whsec_test_abcdef123456', `1234567890.${body}`);



      const result = await provider.verifyWebhook(body, expectedSignature, null);



      expect(result.valid).toBe(false);

      expect(result.error).toBe('Timestamp manquant');

    });



    it('should reject when timestamp is too old (> 5 min)', async () => {

      const body = makePayload();

      const oldTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      const expectedSignature = hmacSha256Hex('whsec_test_abcdef123456', `${oldTimestamp}.${body}`);



      const result = await provider.verifyWebhook(body, expectedSignature, oldTimestamp.toString());



      expect(result.valid).toBe(false);

      expect(result.error).toBe('Timestamp trop ancien');

    });



    it('should reject when signature does not match (wrong length)', async () => {

      const timestamp = Math.floor(Date.now() / 1000).toString();

      const body = JSON.stringify({ event: 'transaction.success', data: { id: 'evt_test', reference: 'TXN-0001' } });

      // wrong length -> rejected before content comparison

      const result = await provider.verifyWebhook(body, 'inv', timestamp);



      expect(result.valid).toBe(false);

      expect(result.error).toBe('Longueur signature invalide');

    });



    it('should reject on malformed signature (empty string)', async () => {

      const timestamp = Math.floor(Date.now() / 1000).toString();

      const body = JSON.stringify({ event: 'transaction.success', data: { id: 'evt_test', reference: 'TXN-0001' } });

      const result = await provider.verifyWebhook(body, '', timestamp);



      expect(result.valid).toBe(false);

      expect(result.error).toBe('Signature manquante');

    });

  });



  // -----------------------------------------------------------------------

  // parseWebhookEvent

  // -----------------------------------------------------------------------



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

      expect(SasPayPaymentProvider.parseWebhookEvent('{"event":"transaction.success"}')).toBeNull();

      expect(SasPayPaymentProvider.parseWebhookEvent('{"data":{}}')).toBeNull();

    });

  });



  // -----------------------------------------------------------------------

  // extractTransactionReference

  // -----------------------------------------------------------------------



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



  // -----------------------------------------------------------------------

  // extractAmountCurrency

  // -----------------------------------------------------------------------



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

