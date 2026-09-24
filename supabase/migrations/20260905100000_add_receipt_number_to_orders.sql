-- Add receipt_number column to orders table
-- Generated automatically after payment confirmation
-- Format: ATEMI-YYYYMMDD-XXXXXX (unique per order)

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_number text NULL;

-- Unique constraint to prevent duplicate receipt numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_receipt_number ON public.orders (receipt_number) WHERE receipt_number IS NOT NULL;
