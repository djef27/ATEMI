-- Stocke l'URL de paiement FedaPay pour eviter de recreer une transaction
-- a chaque rechargement de /paiement (idempotence cote application).
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_url text NULL;