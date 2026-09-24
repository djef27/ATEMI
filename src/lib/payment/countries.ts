export interface CountryPaymentConfig {
  country: string;
  currency: 'XOF';
  paymentMethods: Array<{ id: string; displayName: string; enabled: boolean }>;
  provider: 'cinetpay' | 'fedapay';
}

const COUNTRY_METHODS: Record<string, Array<{ id: string; displayName: string }>> = {
  BJ: [
    { id: 'mtn_money', displayName: 'MTN Mobile Money' },
    { id: 'moov_money', displayName: 'Moov Money' },
    { id: 'celtiis_cash', displayName: 'Celtiis Cash' },
  ],
  CI: [
    { id: 'orange_money', displayName: 'Orange Money' },
    { id: 'mtn_money', displayName: 'MTN Money' },
    { id: 'moov_money', displayName: 'Moov Money' },
    { id: 'wave', displayName: 'Wave' },
  ],
  TG: [
    { id: 'tmoney', displayName: 'T-Money' },
    { id: 'moov_money', displayName: 'Moov Money' },
  ],
};

const ENABLED_METHODS_ENV: Record<string, string> = {
  BJ: 'CINETPAY_ENABLED_METHODS_BJ',
  CI: 'CINETPAY_ENABLED_METHODS_CI',
  TG: 'CINETPAY_ENABLED_METHODS_TG',
};

export function getPaymentMethods(country: string): CountryPaymentConfig | null {
  const code = country.trim().toUpperCase();
  const methods = COUNTRY_METHODS[code];
  if (!methods) return null;

  // Keep the existing FedaPay flow usable until CinetPay is selected.
  // CinetPay operators are exposed only when explicitly configured.
  if (process.env.PAYMENT_PROVIDER?.toLowerCase() !== 'cinetpay') {
    return {
      country: code,
      currency: 'XOF',
      provider: 'fedapay',
      paymentMethods: [{ id: 'mobile_money', displayName: 'Mobile Money', enabled: true }],
    };
  }

  const configured = process.env[ENABLED_METHODS_ENV[code]]
    ?.split(',')
    .map((method) => method.trim().toLowerCase())
    .filter(Boolean);

  return {
    country: code,
    currency: 'XOF',
    provider: 'cinetpay',
    paymentMethods: methods
      .filter((method) => configured?.includes(method.id) ?? false)
      .map((method) => ({ ...method, enabled: true })),
  };
}

export const PAYMENT_COUNTRIES: CountryPaymentConfig[] = [
  {
    country: 'BJ',
    currency: 'XOF',
    provider: 'cinetpay',
    paymentMethods: getPaymentMethods('BJ')?.paymentMethods || [],
  },
  {
    country: 'CI',
    currency: 'XOF',
    provider: 'cinetpay',
    paymentMethods: getPaymentMethods('CI')?.paymentMethods || [],
  },
  {
    country: 'TG',
    currency: 'XOF',
    provider: 'cinetpay',
    paymentMethods: getPaymentMethods('TG')?.paymentMethods || [],
  },
];
