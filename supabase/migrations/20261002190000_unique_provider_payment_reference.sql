CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction_unique
  ON public.payments(provider, provider_transaction_id)
  WHERE provider IS NOT NULL
    AND provider_transaction_id IS NOT NULL;
