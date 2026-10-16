/**
 * Payment configuration — environment validation and startup checks.
 *
 * CRITICAL: This module validates all payment-related env vars at import time.
 * In production, missing/invalid config causes an explicit error instead of
 * silent failure.
 */

export type PaymentProviderName = 'mock' | 'cinetpay' | 'fedapay' | 'kkiapay';

export interface PaymentConfig {
  provider: PaymentProviderName;
  apiKey: string;
  apiSecret: string;
  privateKey: string;
  secretKey: string;
  webhookSecret: string;
  siteId: string;
  sandbox: boolean;
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
  if (raw === 'cinetpay' || raw === 'fedapay' || raw === 'kkiapay') return raw;
  if (process.env.NODE_ENV === 'production' && (!raw || raw === 'mock')) {
    throw new Error(
      '[PAYMENT CONFIG] PAYMENT_PROVIDER doit être configuré avec un prestataire réel en production. ' +
      'Configurez un prestataire de paiement réel.'
    );
  }
  if (raw === 'mock' || !raw) return 'mock';
  throw new Error(
    `[PAYMENT CONFIG] PAYMENT_PROVIDER inconnu: "${raw}". ` +
    `Fournisseurs valides: cinetpay, fedapay, kkiapay`
  );
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
  const sandbox = provider === 'kkiapay'
    ? process.env.KKIAPAY_SANDBOX?.trim().toLowerCase() === 'true'
    : false;

  // In production, all secrets are required for real providers
  if (isProduction && !isMock) {
    if (provider === 'kkiapay' && sandbox && process.env.VERCEL_ENV !== 'preview') {
      throw new Error(
        '[PAYMENT CONFIG] Les clés KKiaPay Sandbox ne peuvent pas être utilisées en production. ' +
        'Configurez les clés Live et définissez KKIAPAY_SANDBOX=false.'
      );
    }

    const apiKey = provider === 'cinetpay'
      ? requireEnv('CINETPAY_API_KEY', process.env.PAYMENT_API_KEY)
      : provider === 'kkiapay'
        ? requireEnv('KKIAPAY_PUBLIC_KEY')
        : requireEnv('PAYMENT_API_KEY');
    const apiSecret = provider === 'cinetpay'
      ? requireEnv('CINETPAY_SECRET_KEY', process.env.PAYMENT_API_SECRET)
      : provider === 'kkiapay'
        ? requireEnv('KKIAPAY_PRIVATE_KEY')
        : requireEnv('PAYMENT_API_SECRET');
    const privateKey = provider === 'kkiapay' ? apiSecret : '';
    const secretKey = provider === 'kkiapay' ? requireEnv('KKIAPAY_SECRET_KEY') : '';
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
    const siteId = provider === 'cinetpay' ? requireEnv('CINETPAY_SITE_ID') : '';

    _config = { provider, apiKey, apiSecret, privateKey, secretKey, webhookSecret, siteId, sandbox, isProduction, isMock };
  } else {
    // Development/test: allow missing secrets for mock
    _config = {
      provider,
      apiKey: provider === 'cinetpay'
        ? process.env.CINETPAY_API_KEY || process.env.PAYMENT_API_KEY || ''
        : provider === 'kkiapay'
          ? process.env.KKIAPAY_PUBLIC_KEY || ''
          : process.env.PAYMENT_API_KEY || '',
      apiSecret: provider === 'cinetpay'
        ? process.env.CINETPAY_SECRET_KEY || process.env.PAYMENT_API_SECRET || ''
        : provider === 'kkiapay'
          ? process.env.KKIAPAY_PRIVATE_KEY || ''
          : process.env.PAYMENT_API_SECRET || '',
      privateKey: process.env.KKIAPAY_PRIVATE_KEY || '',
      secretKey: process.env.KKIAPAY_SECRET_KEY || '',
      webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
      siteId: process.env.CINETPAY_SITE_ID || '',
      sandbox,
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
