-- Add provider-specific transaction traceability without replacing the
-- existing transaction_reference used by the current payment flow.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id
  ON public.payments(provider_transaction_id);
