import * as fs from 'fs';
import * as path from 'path';

/**
 * Contract tests for the KKiaPay server-side verify route.
 *
 * Ensures the critical ordering invariant holds: the amount/currency check
 * must happen BEFORE persisting provider_transaction_id (which would otherwise
 * poison the unique index for a later legitimate confirmation), while keeping
 * the idempotency + unique-constraint guards.
 */
describe('KKiaPay verify — amount checked before any write', () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/payment/kkiapay/verify/route.ts'),
    'utf-8'
  );

  const mismatchError = 'Le montant vérifié ne correspond pas à la commande';
  const persistWrite = 'provider_transaction_id: transaction_id';

  it('keeps the amount/currency mismatch response with XOF-only currency', () => {
    expect(route).toContain(mismatchError);
    expect(route).toContain("payment.currency !== 'XOF'");
  });

  it('checks amount/currency BEFORE persisting provider_transaction_id', () => {
    const mismatchIndex = route.indexOf(mismatchError);
    const persistIndex = route.indexOf(persistWrite);
    expect(mismatchIndex).toBeGreaterThan(-1);
    expect(persistIndex).toBeGreaterThan(-1);
    expect(mismatchIndex).toBeLessThan(persistIndex);
  });

  it('still guards against unique constraint violations (23505)', () => {
    expect(route).toContain('23505');
  });

  it('still checks for a transaction already linked to another order', () => {
    expect(route).toContain('Cette transaction est déjà liée à une autre commande');
  });

  it('keeps persistent idempotency keyed on the provider transaction id', () => {
    expect(route).toContain('pay:kkiapay:');
    expect(route).toContain('checkIdempotencyKey');
  });

  it('confirms via the atomic RPC and dispatches post-payment actions', () => {
    expect(route).toContain('confirm_deposit_payment');
    expect(route).toContain('dispatchPaymentActions');
  });
});