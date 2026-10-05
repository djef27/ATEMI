import type { PaymentConfirmation, PaymentProvider, WebhookVerificationResult } from '../types';

interface KKiaPayConfig {
  publicKey: string;
  privateKey: string;
  secretKey: string;
  sandbox: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class KKiaPayPaymentProvider implements PaymentProvider {
  readonly name = 'kkiapay';

  constructor(private readonly config: KKiaPayConfig) {}

  async verifyWebhook(
    _payload: string,
    _signature: string | null,
    _timestamp: string | null
  ): Promise<WebhookVerificationResult> {
    return {
      valid: false,
      event: null,
      error: 'KKiaPay se vérifie via la confirmation serveur de la transaction',
    };
  }

  async getPaymentStatus(providerTransactionId: string): Promise<PaymentConfirmation> {
    const { kkiapay } = await import('@kkiapay-org/nodejs-sdk');
    const client = kkiapay({
      privatekey: this.config.privateKey,
      publickey: this.config.publicKey,
      secretkey: this.config.secretKey,
      sandbox: this.config.sandbox,
    });
    const rawTransaction: unknown = await client.verify(providerTransactionId);
    if (!isRecord(rawTransaction)) {
      throw new Error('KKiaPay a retourné une réponse de transaction invalide');
    }
    const status = typeof rawTransaction.status === 'string'
      ? rawTransaction.status.toUpperCase()
      : '';
    const transactionId = typeof rawTransaction.transactionId === 'string'
      ? rawTransaction.transactionId
      : '';

    if (!status) {
      throw new Error('KKiaPay a retourné un statut de transaction invalide');
    }
    if (transactionId !== providerTransactionId) {
      throw new Error('La référence retournée par KKiaPay ne correspond pas à la transaction vérifiée');
    }

    const amount = Number(rawTransaction.amount);
    if (!Number.isFinite(amount)) {
      throw new Error('KKiaPay a retourné un montant invalide');
    }

    const paidAt = typeof rawTransaction.performed_at === 'string'
      ? rawTransaction.performed_at
      : typeof rawTransaction.performedAt === 'string'
        ? rawTransaction.performedAt
        : null;
    const paymentMethod = typeof rawTransaction.source_common_name === 'string'
      ? rawTransaction.source_common_name
      : typeof rawTransaction.source === 'string'
        ? rawTransaction.source
        : 'kkiapay';
    const isDebit = rawTransaction.type === 'DEBIT';

    return {
      providerTransactionId,
      amount,
      currency: 'XOF',
      status: status === 'SUCCESS' && isDebit
        ? 'succeeded'
        : ['FAILED', 'CANCELLED', 'CANCELED'].includes(status) ? 'failed' : 'pending',
      paidAt: status === 'SUCCESS' ? paidAt : null,
      metadata: { paymentMethod },
    };
  }

  async isEventProcessed(): Promise<boolean> {
    return false;
  }

  async markEventProcessed(): Promise<void> {
    // The payment confirmation endpoint uses the shared persistent idempotency store.
  }
}
