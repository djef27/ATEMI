import { CinetPayPaymentProvider, createCinetPayPayment } from '@/lib/payment/providers/cinetpay';
import { getPaymentMethods } from '@/lib/payment/countries';

describe('CinetPay provider', () => {
  const config = {
    apiKey: 'test-api-key',
    secretKey: 'test-secret-key',
    siteId: '123456',
  };

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.CINETPAY_ENABLED_METHODS_BJ;
    // cleanup any global fetch polyfill added by tests
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    delete globalWithFetch.fetch;
  });

  it('accepts JSON and form-encoded notifications with a transaction reference', async () => {
    const provider = new CinetPayPaymentProvider(config);

    await expect(provider.verifyWebhook('cpm_trans_id=TX-1&cpm_result=00', null, null))
      .resolves.toMatchObject({ valid: true });
    await expect(provider.verifyWebhook(JSON.stringify({ cpm_trans_id: 'TX-2', cpm_result: '00' }), null, null))
      .resolves.toMatchObject({ valid: true });
    await expect(provider.verifyWebhook('cpm_result=00', null, null))
      .resolves.toMatchObject({ valid: false });
  });

  it('creates a payment only from the server-side adapter', async () => {
    // Jest's jsdom environment may not provide global.fetch/Response.
    // Provide a minimal mock for fetch that returns the expected shape.
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '201', data: { payment_url: 'https://pay.example.test/tx', transaction_id: 'TX-1' } }),
    });

    await expect(createCinetPayPayment({
      transactionId: 'ATEMI-1',
      amount: 5000,
      description: 'Test',
      customerName: 'Client',
      customerPhone: '+22990000000',
      customerEmail: 'client@example.test',
      notifyUrl: 'https://shop.example.test/api/payment/webhook',
      returnUrl: 'https://shop.example.test/paiement',
      config,
    })).resolves.toEqual({
      paymentUrl: 'https://pay.example.test/tx',
      transactionId: 'TX-1',
    });
  });

  it('returns only explicitly configured CinetPay methods', () => {
    process.env.PAYMENT_PROVIDER = 'cinetpay';
    expect(getPaymentMethods('BJ')?.paymentMethods).toEqual([]);

    process.env.CINETPAY_ENABLED_METHODS_BJ = 'mtn_money,moov_money';
    expect(getPaymentMethods('BJ')?.paymentMethods.map((method) => method.id))
      .toEqual(['mtn_money', 'moov_money']);
  });

  it('maps ACCEPTED / SUCCESS → succeeded', async () => {
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { status: 'ACCEPTED', amount: 2500, currency: 'XOF', payment_method: 'MTN_MONEY' } }),
    });

    const provider = new CinetPayPaymentProvider(config);
    const result = await provider.getPaymentStatus('TX-1');

    expect(result.status).toBe('succeeded');
    expect(result.amount).toBe(2500);
    expect(result.currency).toBe('XOF');
    expect(result.paidAt).not.toBeNull();
  });

  it('maps REFUSED / CANCELLED / FAILED → failed', async () => {
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { status: 'REFUSED', amount: 2500, currency: 'XOF' } }),
    });

    const provider = new CinetPayPaymentProvider(config);
    const result = await provider.getPaymentStatus('TX-1');

    expect(result.status).toBe('failed');
    expect(result.paidAt).toBeNull();
  });

  it('maps PENDING / CREATED / unknown → pending', async () => {
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { status: 'PENDING', amount: 2500, currency: 'XOF' } }),
    });

    const provider = new CinetPayPaymentProvider(config);
    const result = await provider.getPaymentStatus('TX-1');

    expect(result.status).toBe('pending');
    expect(result.paidAt).toBeNull();
  });

  it('maps official SUCCESS / FAILED statuses from the check API', async () => {
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };

    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { status: 'SUCCESS', amount: 2500, currency: 'XOF' } }),
    });
    const successResult = await new CinetPayPaymentProvider(config).getPaymentStatus('TX-1');
    expect(successResult.status).toBe('succeeded');

    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { status: 'FAILED', amount: 2500, currency: 'XOF' } }),
    });
    const failedResult = await new CinetPayPaymentProvider(config).getPaymentStatus('TX-1');
    expect(failedResult.status).toBe('failed');
  });

  it('maps INITIATED as pending (never confirmed)', async () => {
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { status: 'INITIATED', amount: 2500, currency: 'XOF' } }),
    });

    const provider = new CinetPayPaymentProvider(config);
    const result = await provider.getPaymentStatus('TX-1');

    expect(result.status).toBe('pending');
    expect(result.paidAt).toBeNull();
  });

  it('throws when the payment check API returns HTTP error', async () => {
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const provider = new CinetPayPaymentProvider(config);
    await expect(provider.getPaymentStatus('TX-1')).rejects.toThrow('CinetPay verification failed with HTTP 500');
  });

  it('reports the correct amount and currency from the payment check API', async () => {
    const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { status: 'ACCEPTED', amount: 7500, currency: 'XOF' } }),
    });

    const provider = new CinetPayPaymentProvider(config);
    const result = await provider.getPaymentStatus('TX-1');

    expect(result.amount).toBe(7500);
    expect(result.currency).toBe('XOF');
  });
});
