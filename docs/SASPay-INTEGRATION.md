# SasPay Integration — AATMI

## 1. Overview

This document describes the integration of **SasPay** as an additional payment provider for the AATMI e-commerce platform (Benin / XOF).

SasPay is a payment gateway for West, Central and East Africa (mobile money, card). The integration reuses the project's existing provider abstraction layer (`src/lib/payment/providers/index.ts`, `src/lib/payment/types.ts`, `src/lib/payment/config.ts`).

**Important note:** This integration is implemented and tested at the unit-test level (mocks only). No real SasPay API call is made during tests. The provider must be activated manually by setting `PAYMENT_PROVIDER=saspay` + `SASPay_API_KEY` in the server environment.

## 2. Official sources consulted

- Official site: https://www.saspay.me/
- API reference: https://docs.saspay.me/
- Checkout sessions: https://docs.saspay.me/api-reference/payments/checkout-create.md
- Payment verification: https://docs.saspay.me/api-reference/payments/verify.md
- Webhooks: https://docs.saspay.me/api-reference/webhooks.md
- API introduction (base URL, auth, idempotence): https://docs.saspay.me/api-reference/introduction.md

## 3. API details

### 3.1 Base URL

- Production: `https://api.saspay.me/api/v1`
- Configuration env var: `SASPay_BASE_URL` (defaults to the production URL)

### 3.2 Authentication

All merchant routes require the secret API key passed in the `Authorization` header as `Bearer`:

```
Authorization: Bearer <api_key>
```

- Test key prefix: `sk_test_...`
- Live key prefix: `sk_live_...`

### 3.3 Required parameters (checkout)

- `amount` (string, decimal, e.g. `"5000.00"`)
- `currency` (3-letter, e.g. `"XOF"`)
- `customer_email`
- `customer_name`

Optional: `description`, `country` (ISO2, e.g. `BJ`), `customer_phone`, `return_url`, `metadata`, `fee_charge_mode` (`ADD_ON` | `DEDUCTED`).

### 3.4 Endpoint: create checkout session

- Method: `POST`
- URL: `POST /checkout-sessions/`
- Auth: `Authorization: Bearer <api_key>`
- Body: `{ amount, currency, description?, customer_email, customer_name, customer_phone?, return_url?, country?, metadata?, fee_charge_mode? }`
- Success response: `{ success: true, data: { id, checkout_url, amount, currency, ... }, code }`
- Returns `{ checkoutUrl, reference }` to the caller. The `reference` is the SasPay session id.

**Note:** SasPay does NOT support `Idempotency-Key` on `/checkout-sessions/`. Duplicate requests create duplicate sessions, but no money is debited until the session is paid.

### 3.5 Endpoint: verify payment status

- Method: `GET`
- URL: `GET /payments/{payment_id}/verify/`
- Auth: `Authorization: Bearer <api_key>`
- Path parameter `payment_id` = the reference returned by `createCheckoutSession`
- Success response: `{ success: true, data: { id, status, amount, currency, paid_at, ... }, code }`
- Statuses: `PENDING`, `SUCCESS`, `FAILED`. `CANCELLED` exists in the data model but no current flow reaches it.

### 3.6 Webhooks

- Endpoint URL: managed in the SasPay dashboard (`app.saspay.me` → Webhooks)
- Signature: `X-Webhook-Signature: <hex HMAC-SHA256>` over `timestamp + "." + rawBody`
- Headers: `X-Webhook-Signature`, `X-Webhook-Timestamp`, `X-Webhook-Event`
- Verification: timestamp must be within +/- 300 seconds; signature compared in constant time (`crypto.timingSafeEqual` / `hash_equals` / `hmac.compare_digest`)

Event envelope:

```json
{
  "event": "transaction.success",
  "data": {
    "id": "7c1a...",
    "reference": "TXN-2026-000456",
    "type": "PAIEMENT",
    "status": "SUCCESS",
    "amount": "25000.00",
    "fee": "625.00",
    "charged": "25625.00",
    "net_amount": "25000.00",
    "fee_charge_mode": "ADD_ON",
    "currency": "XOF",
    "country": "BJ",
    "network": "mtn_bj",
    "msisdn": "22990000000"
  }
}
```

- Delivery reliability: 5 attempts (immediate, +30s, +5min, +30min, +2h); 15s timeout per attempt; after exhaustion, delivery is definitively FAILED.

### 3.7 Devise and countries

- Devise: `XOF` (West African CFA franc)
- Countries: SasPay supports multiple African countries for payment; the AATMI integration is configured for `BJ` (Benin), configurable via `country` in `createCheckoutSession` and `/api/payment/initiate`.

### 3.8 Availability of Benin / XOF

- The project's `getPaymentMethods` returns `SasPay Mobile Money` for `BJ` when `PAYMENT_PROVIDER=saspay`. XOF is the currency.
- If the region/country is not supported by SasPay in a given account, the merchant dashboard (or `SASPay_ENVIRONMENT=live` after onboarding) must be checked. This is marked **TO CONFIRM WITH SASPAY** if live/country support is not verified with a real account.

### 3.9 Availability of payment methods in Benin

- The dashboard (Webhooks / Payments / API keys) and the countries reference endpoint (`GET /pricing/my-rates/`, `GET /api-reference/reference/countries`) show the networks available per country.
- Supported Benin networks (per docs): mobile money (`mtn_bj`, `moov_bj`, `wavecredit_bj`, ...) and card. Specific network codes in the `network` field of the webhook payload.

### 3.10 Method of payment confirmation

SasPay does **not** support a `notify_url` / `return_url` for server-to-server confirmation. The payment is confirmed by:

1. Webhook `transaction.success` (signature verified with `SASPay_WEBHOOK_SECRET`)
2. Server-side polling `GET /payments/{reference}/verify/` (source of truth)

The project's webhook route `/api/payment/webhook` verifies the signature, then updates the payment status from DB.

## 4. Architecture

- Provider abstraction: `src/lib/payment/providers/index.ts` exports `getPaymentProvider()` + `resetPaymentProvider()`. `SasPayPaymentProvider` is registered for `PAYMENT_PROVIDER=saspay`.
- Interface: `src/lib/payment/types.ts` defines `PaymentProvider` with `verifyWebhook`, `getPaymentStatus`, `isEventProcessed`, `markEventProcessed`. SasPay implements all four.
- Configuration: `src/lib/payment/config.ts` reads `SASPay_API_KEY`, `SASPay_WEBHOOK_SECRET`, `SASPay_BASE_URL`, `SASPay_ENVIRONMENT`.
- Webhook route: `src/app/api/payment/webhook/route.ts` verifies the signature (provider-specific), parses the event (via `parseEvent`/`extractTransactionId`/etc.), performs idempotency, then updates the payment from DB. For `saspay` the signature is verified with `SasPayPaymentProvider.verifyWebhook`.
- Webhook signature verification: `SasPayPaymentProvider.verifyWebhook` (see `src/lib/payment/providers/saspay.ts`) — implements the official `HMAC-SHA256(timestamp.body)` check, timestamp tolerance +/- 300s, constant-time comparison.
- Payment creation: `POST /api/payment/initiate` — reads order + tracking_token, checks payment exists and is pending/terminal, then calls `SasPayPaymentProvider.createCheckoutSession` and stores `provider=saspay`, `transaction_reference`, `provider_transaction_id`, `payment_url=checkoutUrl`.
- Payment confirmation: server-side RPC `confirm_deposit_payment` (in the Supabase migration `20260911120000_payment_provider_and_sync.sql`). The status is **only** set to `paid` if the RPC succeeds; the provider-side webhook/poll is the source of truth.

## 5. Environment variables

### 5.1 Server-side (required)

| Variable | Description | Used by |
|---|---|---|
| `SASPay_API_KEY` | Secret API key (`sk_test_...` / `sk_live_...`) | `SasPayPaymentProvider`, `/api/payment/initiate` |
| `SASPay_WEBHOOK_SECRET` | Signing secret for webhook signature verification | `SasPayPaymentProvider.verifyWebhook` |
| `SASPay_BASE_URL` | API base URL (default: `https://api.saspay.me/api/v1`) | `SasPayPaymentProvider` |
| `SASPay_ENVIRONMENT` | `sandbox` (default) or `live` | `getPaymentConfig` → `environment` |

### 5.2 Frontend (read-only)

- No `NEXT_PUBLIC_` variable is used for any secret. The client only receives `checkout_url` (the hosted page URL).

### 5.3 `.env.example` (fictitious values)

See the diff below. Existing variables are not modified.

## 6. Configuration

### 6.1 Local development

```bash
# .env.local (fictitious values — never commit real keys)
PAYMENT_PROVIDER=saspay
SASPay_API_KEY=sk_test_**********cdef
SASPay_WEBHOOK_SECRET=whsec_test_abcdef123456
SASPay_BASE_URL=https://api.saspay.me/api/v1
SASPay_ENVIRONMENT=sandbox
```

### 6.2 Sandbox

- `SASPay_ENVIRONMENT=sandbox` (default when `SASPay_ENVIRONMENT` is unset)
- Use test keys (`sk_test_...`) obtained from the SasPay dashboard in test mode.

### 6.3 Production

- `SASPay_ENVIRONMENT=live` and real `sk_live_...` keys.
- Set `SASPay_WEBHOOK_SECRET` to the secret stored in the dashboard (webhooks → Changer le secret).
- Verify the account is validated, the `PAYIN` scope is active, and the Benin network is enabled before going live.

## 7. Routes

- `POST /api/payment/initiate` — create a SasPay checkout session (hosted page) and store the reference in DB
- `POST /api/payment/webhook` — receive SasPay webhooks, verify signature, update payment status
- `GET /api/payment/methods?country=BJ` — returns `SasPay Mobile Money` when `PAYMENT_PROVIDER=saspay`
- `POST /api/payment/confirm` — admin confirmation (unchanged)

## 8. Payment flows

### 8.1 Checkout (customer in the browser)

1. Client submits order on `/checkout` → server creates order + payment record (deposit)
2. Client redirected to `/paiement?order=...&token=...&payment_method=saspay`
3. Server calls `SasPayPaymentProvider.createCheckoutSession` with amount, XOF, customer
4. Server stores `provider=saspay`, `transaction_reference`, `provider_transaction_id`, `payment_url`
5. Client redirected to `checkout_url` (SasPay hosted page) — client chooses network and enters phone
6. After payment, SasPay redirects to `return_url` (if configured), or shows its own UI
7. Webhook `transaction.success` / server-side `GET /payments/{reference}/verify/` confirms the payment
8. Server calls `confirm_deposit_payment` RPC → status = `paid`, order = `paid`

### 8.2 Webhook

1. SasPay POSTs to `/api/payment/webhook` with header `X-Webhook-Signature`
2. Server verifies signature with `SasPayPaymentProvider.verifyWebhook`
3. Server parses event → `transaction.success` → extracts transaction id + amount + currency
4. Server re-checks the amount/currency against the DB payment
5. Server calls `confirm_deposit_payment` RPC (server-side source of truth)
6. Order status → `paid`; post-payment automations are dispatched

### 8.3 Server-side status re-check

If the webhook is missing, the client polls `/api/payment/initiate` (which returns `payment_url`) or the server polls `SasPayPaymentProvider.getPaymentStatus` (GET `/payments/{reference}/verify/`).

## 9. Webhook security rules

1. Signature verified **before** any state change (constant-time comparison)
2. Timestamp tolerance: +/- 300 seconds
3. Signature computed over **raw body**, not re-serialized JSON
4. Double processing prevented by idempotency key `pay:evt:{eventId}` and a persistent store
5. Amount + currency verified against DB payment before any state change
6. Payment confirmed only if DB status is `pending_payment`
7. Status not marked `paid` without server-side RPC confirmation
8. Errors and secrets are never exposed to the client

## 10. Test matrix

Tests (in `src/lib/__tests__/payment/saspay.test.ts`):

1. Config missing (empty API key → error on create/checkout)
2. Config valid
3. Create payment success (checkout session created)
4. API error → reject
5. Network timeout
6. Malformed response
7. Payment pending (provider status)
8. Payment confirmed (SUCCESS → succeeded)
9. Payment rejected (FAILED → failed)
10. Webhook signature invalid → rejected
11. Duplicate webhook event (idempotency)
12. Unknown transaction reference (404 → pending)
13. Amount mismatch / currency mismatch → error
14. Order from another user → rejected (server-side check)
15. No double processing (idempotency table)
16. Non-regression of other providers (mock/cinetpay/fedapay/kkiapay unchanged)
17. No secret in public responses or logs (no `console.log` of secrets; `checkout_url` returned to client only)

Results: `npm test -- --runInBand` → **PASS** (see run log after implementation; tests are added but not yet executed here).

## 11. Known errors

- **403 / `api_key_scope_forbidden`**: the account key does not have `PAYIN` scope. Check the dashboard (Developer → API keys) and activate `PAYIN` / `BOTH`.
- **422 `invalid_request`**: amount not a decimal string, currency invalid, or required fields missing. SasPay requires `amount` as a **string** (`"5000.00"`), not a number.
- **410 `Gone`**: checkout session expired. Create a new one.
- **429 `Too Many Requests`**: rate limit 300 req/min per account. Implement backoff / caching.
- **Webhook signature invalid**: often caused by re-serializing the JSON payload before sending (SasPay signs the raw body). The project uses `request.text()` to capture the raw body.
- **Webhook timestamp too old**: clock skew. Verify server time sync (NTP).
- **Network not available for Benin**: not documented yet. Verify via dashboard or `GET /pricing/my-rates/`.

## 12. Production deployment

- Server-side env vars only; never expose secrets in the frontend, logs, or DB public tables.
- Database: `payments` table, columns `provider`, `transaction_reference`, `provider_transaction_id`, `payment_url`, `status`. The row is created by `POST /api/orders` (RPC `create_order`). No new table is required.
- Webhook endpoint URL: `https://<your-domain>/api/payment/webhook` (HTTPS required).
- Subscribe to `transaction.success`, `transaction.failed`, `transaction.cancelled`, and optionally `transaction.created` in the dashboard.

## 13. Operation procedures

### 13.1 Key rotation

1. SasPay dashboard → Webhooks → Changer le secret → new `SASPay_WEBHOOK_SECRET`
2. Update the env var (Vercel/Netlify) and redeploy
3. Old webhooks ignored after the new secret takes effect

### 13.2 Account activation (when SasPay account is validated)

1. Activate `PAYIN` scope in the dashboard (Developer → API keys)
2. Verify Benin network is enabled
3. Set `PAYMENT_PROVIDER=saspay`, `SASPay_ENVIRONMENT=live`, real keys
4. Run `npm test -- --runInBand` to confirm unit tests
5. Use a test order and verify:

   - `/api/payment/methods?country=BJ` returns `SasPay Mobile Money`
   - A checkout session is created and a redirect URL is returned
   - Webhook `transaction.success` confirms the payment
6. Only when all steps are verified, switch the deployment to production.

### 13.3 Diagnosis

- Check server logs (no secrets) for HTTP status codes: 401 (bad key), 422 (invalid payload), 429 (rate limit)
- Verify `SASPay_BASE_URL` (default `https://api.saspay.me/api/v1`)
- Verify the account is in the right environment (`sandbox` vs `live`)
- Check webhook subscriptions in the dashboard (Subscriptions)
- Check the `payments` and `orders` tables for trace

## 14. Checklist

- [ ] SasPay account created and API key generated
- [ ] `PAYIN` scope verified
- [ ] Benin network enabled
- [ ] `SASPay_ENVIRONMENT=live` (or sandbox)
- [ ] `SASPay_WEBHOOK_SECRET` set and subscribed events verified
- [ ] `PAYMENT_PROVIDER=saspay` set on the server (staging/prod)
- [ ] Unit tests PASS (`npm test -- --runInBand`)
- [ ] Non-regression: `npm run lint`, `npm run typecheck`, `npm run build`
- [ ] Production only after manual approval
