import * as fs from 'fs';
import * as path from 'path';

/**
 * Contract tests for the payment webhook route.
 *
 * Focus: CinetPay notifications are unsigned, so the final action must be
 * derived exclusively from the provider payment-check API — never from the
 * event-declared outcome. Refund transitions must refuse without a
 * provider-verified API result.
 */
describe('Webhook — CinetPay action trust', () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/payment/webhook/route.ts'),
    'utf-8'
  );

  it('derives CinetPay action from the provider API, not from the event', () => {
    expect(route).toContain("config.provider === 'cinetpay'");
    expect(route).toContain("providerConfirmation?.status === 'succeeded'");
    expect(route).toContain("action = 'payment_confirmed'");
    expect(route).toContain("action = 'payment_failed'");
  });

  it('computes the CinetPay override AFTER the provider API check and BEFORE the state switch', () => {
    const providerCheck = route.indexOf(
      "const providerConfirmation = config.provider === 'cinetpay'"
    );
    const override = route.indexOf("if (config.provider === 'cinetpay') {");
    const stateSwitch = route.indexOf("if (action === 'payment_confirmed') {");
    expect(providerCheck).toBeGreaterThan(-1);
    expect(override).toBeGreaterThan(-1);
    expect(stateSwitch).toBeGreaterThan(-1);
    expect(override).toBeGreaterThan(providerCheck);
    expect(override).toBeLessThan(stateSwitch);
  });

  it('refuses refund transitions without a provider-verified API result', () => {
    expect(route).toContain('Remboursement refusé');
    // The automated paid -> refunded write must be gone
    expect(route).not.toContain("update({ status: 'refunded'");
  });

  it('still handles failure paths and keeps the deprecated actions visible', () => {
    expect(route).toContain('payment_failed');
    expect(route).toContain('payment_refunded');
  });

  it('still verifies amount and currency from the provider', () => {
    expect(route).toContain('providerAmount');
    expect(route).toContain('providerCurrency');
    expect(route).toContain('payment.amount');
    expect(route).toContain('Devise divergente');
  });

  it('reads the raw body and rate-limits webhook traffic', () => {
    expect(route).toContain("request.text()");
    expect(route).toContain('RATE_LIMIT_CONFIGS.paymentWebhook');
  });
});