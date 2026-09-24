# PRODUCTION PAYMENT SETUP

## Overview

This document describes how to configure Atémi for real payment processing in production.

---

## Architecture

```
Client → Checkout → POST /api/orders → Order created (pending_payment)
                                            ↓
                                    Payment initiation
                                            ↓
                                    Client pays via provider
                                            ↓
                                    Webhook → POST /api/payment/webhook
                                            ↓
                                    Signature verification (provider-specific)
                                            ↓
                                    Amount + currency verification
                                            ↓
                                    confirm_deposit_payment (SQL)
                                            ↓
                                    Order → confirmed
                                            ↓
                                    Receipt generated
                                            ↓
                                    Notifications sent
```

---

## Environment Variables

### Required (all environments)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `sb_publishable_xxx` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbG...` |
| `NEXT_PUBLIC_APP_URL` | Application URL | `https://atemi.bj` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `Atémi` |
| `NEXT_PUBLIC_ADMIN_WHATSAPP` | Admin WhatsApp number | `+229XXXXXXXX` |

### Payment Provider

| Variable | Description | Values |
|----------|-------------|--------|
| `PAYMENT_PROVIDER` | Payment provider | `mock`, `cinetpay`, `fedapay`, `stripe`, `paystack` |
| `PAYMENT_API_KEY` | Provider public key | From provider dashboard |
| `PAYMENT_API_SECRET` | Provider secret key | From provider dashboard |
| `PAYMENT_WEBHOOK_SECRET` | Webhook signing secret | From provider dashboard |
| `CINETPAY_API_KEY` | CinetPay API key | From CinetPay dashboard |
| `CINETPAY_SITE_ID` | CinetPay site identifier | From CinetPay dashboard |
| `CINETPAY_SECRET_KEY` | CinetPay secret key | From CinetPay dashboard |

### Rate Limiting (Upstash Redis)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

### WhatsApp Notifications

| Variable | Description | Values |
|----------|-------------|--------|
| `WHATSAPP_PROVIDER` | WhatsApp provider | `mock`, `twilio`, `whatsapp_cloud_api` |
| `WHATSAPP_API_URL` | WhatsApp API URL | From provider |
| `WHATSAPP_API_TOKEN` | WhatsApp API token | From provider |

---

## Development Setup

```bash
# .env.local
PAYMENT_PROVIDER=mock
WHATSAPP_PROVIDER=mock
# Upstash not required (in-memory fallback)
```

- Mock provider accepts all webhooks
- No real transactions
- In-memory rate limiting
- Console logs for WhatsApp messages

---

## Production Setup

### 1. Payment Provider (CinetPay)

1. Create a merchant account at [cinetpay.com](https://cinetpay.com)
2. Get the API key, site ID and secret key from the dashboard
3. Configure the notification URL: `https://your-domain.com/api/payment/webhook`
4. Set environment variables:

```bash
PAYMENT_PROVIDER=cinetpay
CINETPAY_API_KEY=xxx
CINETPAY_SITE_ID=xxx
CINETPAY_SECRET_KEY=xxx
```

CinetPay notifications are not trusted as proof of payment. The webhook calls
`/v2/payment/check` and only confirms the order when the provider reports a
successful transaction with the expected amount and currency.

### 2. Supabase

1. Ensure `create_order` function is deployed
2. Ensure `confirm_deposit_payment` function is deployed
3. Ensure `idempotency_keys` table exists
4. Deploy all migrations from `supabase/migrations/`

### 3. Upstash Redis

1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy REST URL and token
4. Set environment variables:

```bash
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Without Upstash, financial endpoints are BLOCKED in production (fail-closed).**

### 4. WhatsApp

1. Choose a provider (Twilio, WhatsApp Cloud API, etc.)
2. Set environment variables:

```bash
WHATSAPP_PROVIDER=twilio
WHATSAPP_API_URL=https://api.twilio.com/...
WHATSAPP_API_TOKEN=xxx
```

---

## Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set and not a placeholder
- [ ] `PAYMENT_WEBHOOK_SECRET` is set and matches provider dashboard
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
- [ ] `.env.local` is NOT committed to git (check `.gitignore`)
- [ ] Webhook URL uses HTTPS
- [ ] Webhook signature verification is enabled
- [ ] No secrets are exposed in frontend code
- [ ] `NEXT_PUBLIC_` prefix only on non-sensitive variables
- [ ] Payment confirm endpoint requires admin authentication
- [ ] Rate limiting is active on financial endpoints
- [ ] Idempotency is active on payment confirmation

---

## Before Going Live

### Tests to Run

```bash
# Run all tests
npx jest

# Expected: 195+ tests passing
```

### Manual Verification

1. **Create test order** via checkout
2. **Verify webhook** with provider's test mode
3. **Check receipt** only appears after payment confirmation
4. **Check notifications** only sent after payment confirmation
5. **Test payment failure** — order should not become `paid`
6. **Test duplicate webhook** — should be idempotent
7. **Test rate limiting** — excessive requests should be blocked

### Database Verification

```sql
-- Check payments table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payments';

-- Verify confirm_deposit_payment is SECURITY DEFINER
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'confirm_deposit_payment';

-- Verify function is restricted to service_role
SELECT * FROM pg_proc_roles
WHERE proname = 'confirm_deposit_payment';
```

---

## Switching from Mock to Production

1. Set `PAYMENT_PROVIDER=fedapay` (or your provider)
2. Set `PAYMENT_API_KEY`, `PAYMENT_API_SECRET`, `PAYMENT_WEBHOOK_SECRET`
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Deploy webhook URL to provider dashboard
5. Test with provider's sandbox/test mode first
6. Switch to live keys when ready

**Important:** The `create_order` SQL function previously hardcoded `provider: 'mock'`. Since migration `20260911120000_payment_provider_and_sync.sql`, it accepts a `p_provider` parameter and the `/api/orders` route passes the configured provider — the payments table now stores the real provider name automatically.

---

## Troubleshooting

### "Webhook non configuré" (501)
- `PAYMENT_PROVIDER` is `mock` or `PAYMENT_WEBHOOK_SECRET` is empty

### Financial endpoints blocked in production
- `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` missing

### "Signature invalide" (401)
- Webhook secret doesn't match provider dashboard
- Provider is sending to wrong URL

### "Paiement introuvable" (404)
- Transaction reference doesn't match any payment in DB
- Payment was not created via `create_order`

### Receipt not showing
- Payment status is not `paid`
- Check `payments` table for status

---

## Provider-Specific Notes

### FedaPay
- Amount: XOF with `div:1` (no cents)
- Currency: `currency_id` (numeric), `1 = XOF`
- Signature header: `x-fedapay-signature`
- Event parsing: `entity` field is JSON string (must parse twice)
- Webhook package: `fedapay` npm package

### Stripe
- Amount: cents (divide by 100)
- Currency: ISO string
- Signature header: `stripe-signature`
- Event parsing: `data.object` shape

### Paystack
- Amount: kobo (divide by 100)
- Currency: ISO string
- Signature header: `x-paystack-signature`
- Event parsing: `data.object` shape
