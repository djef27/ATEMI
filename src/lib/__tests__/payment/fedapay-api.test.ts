import {
  createFedaPayPaymentUrl,
  createFedaPayTransaction,
  getFedaPayBaseUrl,
  getFedaPayTransaction,
} from '@/lib/payment/providers/fedapay-api';

describe('FedaPay API helpers', () => {
  const globalWithFetch = globalThis as Omit<typeof globalThis, 'fetch'> & { fetch?: typeof fetch };

  afterEach(() => {
    jest.restoreAllMocks();
    delete globalWithFetch.fetch;
  });

  it('creates a transaction using the official v1 endpoint and accepts its documented response shape', async () => {
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 123, reference: 'FDP-123', status: 'pending' }),
    });

    const transaction = await createFedaPayTransaction({
      apiSecret: 'sk_test_secret',
      baseUrl: 'https://sandbox-api.fedapay.com',
      body: { amount: 5000, currency: { iso: 'XOF' } },
    });

    expect(transaction).toEqual({
      id: '123',
      reference: 'FDP-123',
      status: 'pending',
      paymentUrl: null,
    });
    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      'https://sandbox-api.fedapay.com/v1/transactions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk_test_secret',
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('creates a hosted payment link through the official transaction token endpoint', async () => {
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'token-123', url: 'https://checkout.fedapay.com/token-123' }),
    });

    await expect(
      createFedaPayPaymentUrl('123', 'sk_test_secret', 'https://sandbox-api.fedapay.com')
    ).resolves.toBe('https://checkout.fedapay.com/token-123');
    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      'https://sandbox-api.fedapay.com/v1/transactions/123/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('retrieves a transaction by its numeric provider ID and unwraps the API response', async () => {
    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        'v1/transaction': {
          id: 123,
          reference: 'FDP-123',
          status: 'approved',
          payment_url: 'https://checkout.fedapay.com/token-123',
        },
      }),
    });

    await expect(
      getFedaPayTransaction('123', 'sk_test_secret', 'https://sandbox-api.fedapay.com')
    ).resolves.toEqual({
      id: '123',
      reference: 'FDP-123',
      status: 'approved',
      paymentUrl: 'https://checkout.fedapay.com/token-123',
    });
  });

  it('rejects invalid IDs, insecure payment URLs, and failed API responses', async () => {
    await expect(
      getFedaPayTransaction('FDP-123', 'sk_test_secret', 'https://sandbox-api.fedapay.com')
    ).rejects.toThrow('identifiant de transaction FedaPay est invalide');

    globalWithFetch.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'http://checkout.fedapay.com/token-123' }),
    });
    await expect(
      createFedaPayPaymentUrl('123', 'sk_test_secret', 'https://sandbox-api.fedapay.com')
    ).rejects.toThrow('lien de paiement non sécurisé');

    globalWithFetch.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      createFedaPayPaymentUrl('123', 'sk_test_secret', 'https://sandbox-api.fedapay.com')
    ).rejects.toThrow('HTTP 503');
  });

  it('selects the environment from the FedaPay secret key', () => {
    expect(getFedaPayBaseUrl('sk_test_example')).toBe('https://sandbox-api.fedapay.com');
    expect(getFedaPayBaseUrl('sk_live_example')).toBe('https://api.fedapay.com');
  });
});
