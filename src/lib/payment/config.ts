/**
 * Payment configuration — environment validation and startup checks.
 *
 * CRITICAL: This module validates all payment-related env vars at import time.
 * In production, missing/invalid config causes an explicit error instead of
 * silent failure.
 */

export type PaymentProviderName = 'mock' | 'cinetpay' | 'fedapay' | 'stripe' | 'paystack';

export interface PaymentConfig {
  provider: PaymentProviderName;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  siteId: string;
  isProduction: boolean;
  isMock: boolean;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(
      `[PAYMENT CONFIG] Variable d'environnement manquante: ${name}. ` +
      `Configurez-la dans .env.local (développement) ou les variables d'environnement (production).`
    );
  }
  return value;
}

function getProviderName(): PaymentProviderName {
  const raw = process.env.PAYMENT_PROVIDER?.toLowerCase().trim();
  if (raw === 'cinetpay' || raw === 'fedapay' || raw === 'stripe' || raw === 'paystack') return raw;
  if (process.env.NODE_ENV === 'production' && (!raw || raw === 'mock')) {
    throw new Error(
      '[PAYMENT CONFIG] PAYMENT_PROVIDER doit être configuré avec un prestataire réel en production. ' +
      'Configurez un prestataire de paiement réel.'
    );
  }
  if (process.env.NODE_ENV === 'production' && raw) {
    throw new Error(
      `[PAYMENT CONFIG] PAYMENT_PROVIDER inconnu: "${raw}". ` +
      `Providers valides: cinetpay, fedapay, stripe, paystack`
    );
  }
  return 'mock';
}

/**
 * Get payment configuration. Lazy-loaded to avoid throwing at module import
 * time in test environments.
 */
let _config: PaymentConfig | null = null;

export function getPaymentConfig(): PaymentConfig {
  if (_config) return _config;

  const isProduction = process.env.NODE_ENV === 'production';
  const provider = getProviderName();
  const isMock = provider === 'mock';

  // In production, all secrets are required for real providers
  if (isProduction && !isMock) {
    const apiKey = provider === 'cinetpay'
      ? requireEnv('CINETPAY_API_KEY', process.env.PAYMENT_API_KEY)
      : requireEnv('PAYMENT_API_KEY');
    const apiSecret = provider === 'cinetpay'
      ? requireEnv('CINETPAY_SECRET_KEY', process.env.PAYMENT_API_SECRET)
      : requireEnv('PAYMENT_API_SECRET');
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
    const siteId = provider === 'cinetpay' ? requireEnv('CINETPAY_SITE_ID') : '';

    _config = { provider, apiKey, apiSecret, webhookSecret, siteId, isProduction, isMock };
  } else {
    // Development/test: allow missing secrets for mock
    _config = {
      provider,
      apiKey: provider === 'cinetpay'
        ? process.env.CINETPAY_API_KEY || process.env.PAYMENT_API_KEY || ''
        : process.env.PAYMENT_API_KEY || '',
      apiSecret: provider === 'cinetpay'
        ? process.env.CINETPAY_SECRET_KEY || process.env.PAYMENT_API_SECRET || ''
        : process.env.PAYMENT_API_SECRET || '',
      webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
      siteId: process.env.CINETPAY_SITE_ID || '',
      isProduction,
      isMock,
    };
  }

  return _config;
}

/**
 * Validate that SUPABASE_SERVICE_ROLE_KEY is not a placeholder.
 * Call this in production API routes that use the admin client.
 */
export function validateServiceRoleKey(): void {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      '[PAYMENT CONFIG] SUPABASE_SERVICE_ROLE_KEY manquante. ' +
      'Les opérations serveur critiques ne peuvent pas fonctionner.'
    );
  }

  // Check for common placeholders
  const placeholders = [
    'your_service_role_key_here',
    'placeholder',
    'REPLACE_ME',
    'xxx',
  ];

  const lowerKey = key.toLowerCase();
  for (const placeholder of placeholders) {
    if (lowerKey.includes(placeholder)) {
      throw new Error(
        `[PAYMENT CONFIG] SUPABASE_SERVICE_ROLE_KEY contient un placeholder: "${placeholder}". ` +
        `Remplacez-la par la vraie clé de votre projet Supabase.`
      );
    }
  }
}

/**
 * Reset config cache (for testing only).
 */
export function resetPaymentConfig(): void {
  _config = null;
}
