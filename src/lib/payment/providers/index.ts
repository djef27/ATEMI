/**
 * Payment provider factory.
 *
 * Returns the correct provider adapter based on PAYMENT_PROVIDER env var.
 * In production with a real provider, the adapter is a singleton.
 * In dev/test with mock, a new instance is created each time.
 */

import type { PaymentProvider } from '../types';
import { getPaymentConfig } from '../config';
import { MockPaymentProvider } from './mock';
import { FedaPayPaymentProvider } from './fedapay';
import { CinetPayPaymentProvider } from './cinetpay';
import { KKiaPayPaymentProvider } from './kkiapay';

let _realProvider: PaymentProvider | null = null;

/**
 * Get the payment provider instance.
 * - Mock: new instance each time (stateless)
 * - Real: singleton (shared state, connection pooling)
 */
export function getPaymentProvider(): PaymentProvider {
  const config = getPaymentConfig();

  if (config.isMock) {
    return new MockPaymentProvider();
  }

  // Real provider: singleton
  if (_realProvider) return _realProvider;

  switch (config.provider) {
    case 'cinetpay':
      _realProvider = new CinetPayPaymentProvider({
        apiKey: config.apiKey,
        secretKey: config.apiSecret,
        siteId: config.siteId,
      });
      break;
    case 'fedapay':
      _realProvider = new FedaPayPaymentProvider({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        webhookSecret: config.webhookSecret,
      });
      break;
    case 'kkiapay':
      _realProvider = new KKiaPayPaymentProvider({
        publicKey: config.apiKey,
        privateKey: config.privateKey,
        secretKey: config.secretKey,
        sandbox: config.sandbox,
      });
      break;

    default:
      throw new Error(
        `[PAYMENT] Provider non supporté: ${config.provider}. ` +
        `Fournisseurs disponibles: mock, cinetpay, fedapay, kkiapay.`
      );
  }

  return _realProvider;
}

/**
 * Reset provider singleton (for testing only).
 */
export function resetPaymentProvider(): void {
  _realProvider = null;
}

export { MockPaymentProvider } from './mock';
export { FedaPayPaymentProvider } from './fedapay';
export { CinetPayPaymentProvider } from './cinetpay';
export { KKiaPayPaymentProvider } from './kkiapay';
