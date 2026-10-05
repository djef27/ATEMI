import { getPaymentMethods } from '@/lib/payment/countries';
import { KKiaPayPaymentProvider } from '@/lib/payment/providers/kkiapay';

jest.mock('@kkiapay-org/nodejs-sdk', () => ({
  kkiapay: jest.fn(() => ({
    verify: jest.fn().mockResolvedValue({
      transactionId: 'KK-1',
      amount: 5000,
      status: 'SUCCESS',
      type: 'DEBIT',
      performed_at: '2026-10-02T12:00:00.000Z',
      source: 'MOBILE_MONEY',
    }),
  })),
}));

describe('KKiaPay payment provider', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
  });

  it('exposes KKiaPay mobile money for supported XOF countries', () => {
    process.env.PAYMENT_PROVIDER = 'kkiapay';
    expect(getPaymentMethods('BJ')).toMatchObject({
      provider: 'kkiapay',
      paymentMethods: [{ id: 'mobile_money', enabled: true }],
    });
  });

  it('verifies the transaction with the server SDK and normalizes its result', async () => {
    const provider = new KKiaPayPaymentProvider({
      publicKey: 'public-test',
      privateKey: 'private-test',
      secretKey: 'secret-test',
      sandbox: true,
    });

    await expect(provider.getPaymentStatus('KK-1')).resolves.toMatchObject({
      providerTransactionId: 'KK-1',
      amount: 5000,
      currency: 'XOF',
      status: 'succeeded',
      paidAt: '2026-10-02T12:00:00.000Z',
      metadata: { paymentMethod: 'MOBILE_MONEY' },
    });
  });

  it('rejects webhook-based confirmation because KKiaPay must be verified server-side', async () => {
    const provider = new KKiaPayPaymentProvider({
      publicKey: 'public-test',
      privateKey: 'private-test',
      secretKey: 'secret-test',
      sandbox: true,
    });

    await expect(provider.verifyWebhook('{}', null, null)).resolves.toMatchObject({ valid: false });
  });
});
