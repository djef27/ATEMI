-- ============================================================================
-- Schema alignment: align migration schema with production database
-- ============================================================================
-- The production database has evolved from the initial migration.
-- This migration adds missing columns and renames to match production.
-- Safe to run: uses IF NOT EXISTS / IF EXISTS guards.

-- 1. PROFILES: add full_name and whatsapp_number if missing
DO $$
BEGIN
  -- Add full_name if it doesn't exist (production has this column)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT NOT NULL DEFAULT '';
    -- Copy data from first_name + last_name if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_name') THEN
      UPDATE public.profiles SET full_name = TRIM(first_name || ' ' || last_name) WHERE full_name = '';
    END IF;
  END IF;

  -- Add whatsapp_number if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp_number') THEN
    ALTER TABLE public.profiles ADD COLUMN whatsapp_number TEXT;
    -- Copy data from whatsapp column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp') THEN
      UPDATE public.profiles SET whatsapp_number = whatsapp WHERE whatsapp_number IS NULL;
    END IF;
  END IF;
END $$;

-- 2. ORDER_ITEMS: add non-snapshot column names if missing
DO $$
BEGIN
  -- Add product_name if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_name') THEN
    ALTER TABLE public.order_items ADD COLUMN product_name TEXT;
    -- Copy from snapshot if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_name_snapshot') THEN
      UPDATE public.order_items SET product_name = product_name_snapshot WHERE product_name IS NULL;
      ALTER TABLE public.order_items ALTER COLUMN product_name SET NOT NULL;
      ALTER TABLE public.order_items ALTER COLUMN product_name SET DEFAULT '';
    END IF;
  END IF;

  -- Add unit_price if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'unit_price') THEN
    ALTER TABLE public.order_items ADD COLUMN unit_price NUMERIC(12,2);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'unit_price_snapshot') THEN
      UPDATE public.order_items SET unit_price = unit_price_snapshot WHERE unit_price IS NULL;
      ALTER TABLE public.order_items ALTER COLUMN unit_price SET NOT NULL;
      ALTER TABLE public.order_items ALTER COLUMN unit_price SET DEFAULT 0;
    END IF;
  END IF;

  -- Add line_total if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'line_total') THEN
    ALTER TABLE public.order_items ADD COLUMN line_total NUMERIC(12,2);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_price') THEN
      UPDATE public.order_items SET line_total = total_price WHERE line_total IS NULL;
      ALTER TABLE public.order_items ALTER COLUMN line_total SET NOT NULL;
      ALTER TABLE public.order_items ALTER COLUMN line_total SET DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 3. PAYMENT_STATUS enum: add 'paid' if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'paid' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')) THEN
    ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'paid' AFTER 'pending';
  END IF;
END $$;

-- 4. ORDER_STATUS enum: add 'completed' if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed' AFTER 'delivered';
  END IF;
END $$;

-- 5. VENDORS: add email column if missing (used by admin vendor creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'email') THEN
    ALTER TABLE public.vendors ADD COLUMN email TEXT;
  END IF;
END $$;
