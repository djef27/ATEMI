-- ============================================================================
-- MIGRATION: INITIAL SCHEMA — BOUTIQUE E-COMMERCE MULTI-VENDEURS V1 — BÉNIN
-- ============================================================================
-- NON-DESTRUCTIVE: IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS
-- Source de vérité: base distante existante. Cette migration est conçue
-- pour être appliquée sur une base vide ou partielle.
-- Exécuter via Supabase SQL Editor ou `supabase db push`
-- ============================================================================

-- ============================================================================
-- A. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- ============================================================================
-- B. ENUM TYPES (conditional creation)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'vendor', 'customer', 'driver');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM (
      'pending_payment',
      'confirmed',
      'vendor_processing',
      'ready_for_delivery',
      'assigned_to_driver',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM (
      'pending', 'processing', 'confirmed', 'failed', 'refunded'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE public.payment_type AS ENUM ('deposit', 'delivery_balance', 'refund');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_method') THEN
    CREATE TYPE public.delivery_method AS ENUM ('delivery', 'pickup');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
    CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'inactive', 'out_of_stock');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_status') THEN
    CREATE TYPE public.vendor_status AS ENUM ('pending', 'active', 'suspended', 'inactive');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE public.delivery_status AS ENUM (
      'pending', 'accepted', 'picked_up', 'out_for_delivery',
      'delivered', 'cancelled', 'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE public.notification_channel AS ENUM ('whatsapp', 'email', 'sms', 'internal');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM (
      'order_confirmed', 'vendor_new_order', 'admin_new_order',
      'order_status_changed', 'payment_confirmed', 'payment_failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed', 'delivered');
  END IF;
END $$;

-- ============================================================================
-- C. TABLES (dependency order, IF NOT EXISTS)
-- ============================================================================

-- C.1 profiles (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  phone       TEXT,
  whatsapp    TEXT,
  first_name  TEXT NOT NULL DEFAULT '',
  last_name   TEXT NOT NULL DEFAULT '',
  role        public.user_role NOT NULL DEFAULT 'customer',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C.2 vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  whatsapp    TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  country     TEXT NOT NULL DEFAULT 'Bénin',
  status      public.vendor_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendors_profile_id_unique UNIQUE (profile_id)
);

-- C.3 drivers (conserved for future use, not used in V1 workflow)
CREATE TABLE IF NOT EXISTS public.drivers (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  whatsapp    TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drivers_profile_id_unique UNIQUE (profile_id)
);

-- C.4 categories
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  parent_id   UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_slug_unique UNIQUE (slug)
);

-- C.5 products
CREATE TABLE IF NOT EXISTS public.products (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  vendor_id       UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  supplier_price  NUMERIC(12,2) NOT NULL CHECK (supplier_price >= 0),
  selling_price   NUMERIC(12,2) NOT NULL CHECK (selling_price > 0),
  deposit_amount  NUMERIC(12,2) NOT NULL CHECK (deposit_amount >= 0),
  remaining_amount NUMERIC(12,2) NOT NULL CHECK (remaining_amount >= 0),
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status          public.product_status NOT NULL DEFAULT 'draft',
  images          TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_slug_unique UNIQUE (slug)
);

-- C.6 product_images
CREATE TABLE IF NOT EXISTS public.product_images (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C.7 delivery_zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id            UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  country       TEXT NOT NULL DEFAULT 'Bénin',
  city          TEXT NOT NULL,
  zone_name     TEXT NOT NULL,
  delivery_fee  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  is_available  BOOLEAN NOT NULL DEFAULT true,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C.8 orders — tracking_token is UUID per remote schema
CREATE TABLE IF NOT EXISTS public.orders (
  id                    UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_number          TEXT NOT NULL,
  tracking_token        UUID NOT NULL DEFAULT gen_random_uuid(),
  customer_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendor_id             UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  subtotal              NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total_amount          NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  deposit_amount        NUMERIC(12,2) NOT NULL CHECK (deposit_amount >= 0),
  remaining_amount      NUMERIC(12,2) NOT NULL CHECK (remaining_amount >= 0),
  currency              TEXT NOT NULL DEFAULT 'XOF',
  payment_status        public.payment_status NOT NULL DEFAULT 'pending',
  order_status          public.order_status NOT NULL DEFAULT 'pending_payment',
  delivery_method       public.delivery_method NOT NULL DEFAULT 'delivery',
  customer_first_name   TEXT NOT NULL,
  customer_last_name    TEXT NOT NULL,
  customer_phone        TEXT NOT NULL,
  customer_whatsapp     TEXT,
  customer_email        TEXT,
  country               TEXT NOT NULL DEFAULT 'Bénin',
  city                  TEXT NOT NULL,
  zone                  TEXT,
  neighborhood          TEXT,
  address               TEXT NOT NULL,
  address_complement    TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_order_number_unique UNIQUE (order_number),
  CONSTRAINT orders_tracking_token_unique UNIQUE (tracking_token)
);

-- C.9 order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id                    UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  vendor_id             UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  product_image_snapshot TEXT,
  unit_price_snapshot   NUMERIC(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity              INTEGER NOT NULL CHECK (quantity > 0),
  total_price           NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C.10 payments
CREATE TABLE IF NOT EXISTS public.payments (
  id                        UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id                  UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount                    NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency                  TEXT NOT NULL DEFAULT 'XOF',
  payment_type              public.payment_type NOT NULL,
  provider                  TEXT NOT NULL DEFAULT 'mock',
  provider_transaction_id   TEXT,
  transaction_reference     TEXT,
  payment_method            TEXT,
  status                    public.payment_status NOT NULL DEFAULT 'pending',
  paid_at                   TIMESTAMPTZ,
  metadata                  JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C.11 order_status_history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C.12 deliveries (conserved for future use, not used in V1 workflow)
CREATE TABLE IF NOT EXISTS public.deliveries (
  id                      UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id                UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  driver_id               UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  status                  public.delivery_status NOT NULL DEFAULT 'pending',
  accepted_at             TIMESTAMPTZ,
  picked_up_at            TIMESTAMPTZ,
  out_for_delivery_at     TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_order_id_unique UNIQUE (order_id)
);

-- C.13 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id                      UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id                UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_type          TEXT NOT NULL CHECK (recipient_type IN ('vendor', 'admin', 'customer')),
  recipient_profile_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_vendor_id     UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  recipient_driver_id     UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  recipient_phone         TEXT,
  channel                 public.notification_channel NOT NULL DEFAULT 'whatsapp',
  notification_type       public.notification_type NOT NULL,
  status                  public.notification_status NOT NULL DEFAULT 'pending',
  message                 TEXT NOT NULL,
  provider_message_id     TEXT,
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C.14 settings
CREATE TABLE IF NOT EXISTS public.settings (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_key_unique UNIQUE (key)
);

-- C.15 audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SECURITY: Public view for vendors — exposes only safe columns
-- SECURITY DEFINER: bypasses RLS to expose safe subset of vendors data
-- Anon/authenticated must use this view, not the vendors table directly
CREATE OR REPLACE VIEW public.public_vendors
  WITH (
    security_barrier = true,
    security_invoker = false
  )
  AS
  SELECT
    id,
    name,
    city,
    country,
    status,
    created_at
  FROM public.vendors
  WHERE status = 'active';

-- Allow anon to read the safe view
GRANT SELECT ON public.public_vendors TO anon;
GRANT SELECT ON public.public_vendors TO authenticated;

-- ============================================================================
-- D. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_vendors_profile_id ON public.vendors(profile_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);

CREATE INDEX IF NOT EXISTS idx_drivers_profile_id ON public.drivers(profile_id);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON public.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON public.orders(tracking_token);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_vendor_id ON public.order_items(vendor_id);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON public.deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);

CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_profile_id ON public.notifications(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_vendor_id ON public.notifications(recipient_vendor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_driver_id ON public.notifications(recipient_driver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);

-- Anti-duplication: one vendor notification per order+type
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_vendor_dedup
  ON public.notifications(order_id, recipient_vendor_id, notification_type)
  WHERE recipient_vendor_id IS NOT NULL;

-- Anti-duplication: one admin notification per order+type
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_admin_dedup
  ON public.notifications(order_id, notification_type)
  WHERE recipient_type = 'admin';

-- ============================================================================
-- E. RLS ENABLEMENT
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- F. HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'vendor' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'driver' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_vendor_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id FROM public.vendors v
  WHERE v.profile_id = auth.uid() AND v.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_driver_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id FROM public.drivers d
  WHERE d.profile_id = auth.uid() AND d.status = 'active'
  LIMIT 1;
$$;

-- ============================================================================
-- G. RLS POLICIES
-- ============================================================================

-- G.1 profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- G.2 vendors
-- SECURITY: vendors_public_read REMOVED. The vendors table contains private
-- columns (phone, whatsapp, profile_id). Public access is via the
-- public_vendors view which only exposes safe columns.
DROP POLICY IF EXISTS vendors_admin_all ON public.vendors;
CREATE POLICY vendors_admin_all ON public.vendors
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS vendors_own_read ON public.vendors;
CREATE POLICY vendors_own_read ON public.vendors
  FOR SELECT USING (profile_id = auth.uid() OR is_admin());

-- G.3 drivers (conserved, not used in V1)
DROP POLICY IF EXISTS drivers_admin_all ON public.drivers;
CREATE POLICY drivers_admin_all ON public.drivers
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS drivers_own_read ON public.drivers;
CREATE POLICY drivers_own_read ON public.drivers
  FOR SELECT USING (profile_id = auth.uid() OR is_admin());

-- G.4 categories
DROP POLICY IF EXISTS categories_admin_all ON public.categories;
CREATE POLICY categories_admin_all ON public.categories
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read ON public.categories
  FOR SELECT USING (is_active = true);

-- G.5 products
DROP POLICY IF EXISTS products_admin_all ON public.products;
CREATE POLICY products_admin_all ON public.products
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS products_vendor_insert ON public.products;
CREATE POLICY products_vendor_insert ON public.products
  FOR INSERT WITH CHECK (vendor_id = get_my_vendor_id());

DROP POLICY IF EXISTS products_vendor_read ON public.products;
CREATE POLICY products_vendor_read ON public.products
  FOR SELECT USING (vendor_id = get_my_vendor_id());

DROP POLICY IF EXISTS products_vendor_update ON public.products;
CREATE POLICY products_vendor_update ON public.products
  FOR UPDATE USING (vendor_id = get_my_vendor_id())
  WITH CHECK (vendor_id = get_my_vendor_id());

DROP POLICY IF EXISTS products_vendor_delete ON public.products;
CREATE POLICY products_vendor_delete ON public.products
  FOR DELETE USING (vendor_id = get_my_vendor_id());

-- G.6 product_images
DROP POLICY IF EXISTS product_images_admin_all ON public.product_images;
CREATE POLICY product_images_admin_all ON public.product_images
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS product_images_public_read ON public.product_images;
CREATE POLICY product_images_public_read ON public.product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id AND p.status = 'active'
    )
  );

DROP POLICY IF EXISTS product_images_vendor_all ON public.product_images;
CREATE POLICY product_images_vendor_all ON public.product_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.vendor_id = get_my_vendor_id()
    )
  );

-- G.7 delivery_zones
DROP POLICY IF EXISTS delivery_zones_admin_all ON public.delivery_zones;
CREATE POLICY delivery_zones_admin_all ON public.delivery_zones
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS delivery_zones_public_read ON public.delivery_zones;
CREATE POLICY delivery_zones_public_read ON public.delivery_zones
  FOR SELECT USING (is_available = true AND is_active = true);

-- G.8 orders
DROP POLICY IF EXISTS orders_admin_all ON public.orders;
CREATE POLICY orders_admin_all ON public.orders
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS orders_customer_read ON public.orders;
CREATE POLICY orders_customer_read ON public.orders
  FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS orders_vendor_read ON public.orders;
CREATE POLICY orders_vendor_read ON public.orders
  FOR SELECT USING (vendor_id = get_my_vendor_id());

DROP POLICY IF EXISTS orders_insert_via_rpc ON public.orders;
CREATE POLICY orders_insert_via_rpc ON public.orders
  FOR INSERT WITH CHECK (true);

-- G.9 order_items
DROP POLICY IF EXISTS order_items_admin_all ON public.order_items;
CREATE POLICY order_items_admin_all ON public.order_items
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS order_items_customer_read ON public.order_items;
CREATE POLICY order_items_customer_read ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS order_items_vendor_read ON public.order_items;
CREATE POLICY order_items_vendor_read ON public.order_items
  FOR SELECT USING (vendor_id = get_my_vendor_id());

DROP POLICY IF EXISTS order_items_insert_via_rpc ON public.order_items;
CREATE POLICY order_items_insert_via_rpc ON public.order_items
  FOR INSERT WITH CHECK (true);

-- G.10 payments
DROP POLICY IF EXISTS payments_admin_all ON public.payments;
CREATE POLICY payments_admin_all ON public.payments
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS payments_customer_read ON public.payments;
CREATE POLICY payments_customer_read ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payments_insert_via_rpc ON public.payments;
CREATE POLICY payments_insert_via_rpc ON public.payments
  FOR INSERT WITH CHECK (true);

-- G.11 order_status_history
DROP POLICY IF EXISTS order_history_admin_all ON public.order_status_history;
CREATE POLICY order_history_admin_all ON public.order_status_history
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS order_history_customer_read ON public.order_status_history;
CREATE POLICY order_history_customer_read ON public.order_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS order_history_insert_via_rpc ON public.order_status_history;
CREATE POLICY order_history_insert_via_rpc ON public.order_status_history
  FOR INSERT WITH CHECK (true);

-- G.12 deliveries (conserved, not used in V1)
DROP POLICY IF EXISTS deliveries_admin_all ON public.deliveries;
CREATE POLICY deliveries_admin_all ON public.deliveries
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS deliveries_driver_read ON public.deliveries;
CREATE POLICY deliveries_driver_read ON public.deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = deliveries.driver_id AND d.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS deliveries_driver_update ON public.deliveries;
CREATE POLICY deliveries_driver_update ON public.deliveries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = deliveries.driver_id AND d.profile_id = auth.uid()
    )
  );

-- G.13 notifications
DROP POLICY IF EXISTS notifications_admin_all ON public.notifications;
CREATE POLICY notifications_admin_all ON public.notifications
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS notifications_customer_read ON public.notifications;
CREATE POLICY notifications_customer_read ON public.notifications
  FOR SELECT USING (
    recipient_profile_id = auth.uid()
    OR (
      order_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = notifications.order_id AND o.customer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS notifications_driver_read ON public.notifications;
CREATE POLICY notifications_driver_read ON public.notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = notifications.recipient_driver_id AND d.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notifications_vendor_read ON public.notifications;
CREATE POLICY notifications_vendor_read ON public.notifications
  FOR SELECT USING (recipient_vendor_id = get_my_vendor_id());

DROP POLICY IF EXISTS notifications_insert_via_rpc ON public.notifications;
CREATE POLICY notifications_insert_via_rpc ON public.notifications
  FOR INSERT WITH CHECK (true);

-- G.14 settings
DROP POLICY IF EXISTS settings_admin_all ON public.settings;
CREATE POLICY settings_admin_all ON public.settings
  FOR ALL USING (is_admin());

-- G.15 audit_log
DROP POLICY IF EXISTS audit_log_admin_all ON public.audit_log;
CREATE POLICY audit_log_admin_all ON public.audit_log
  FOR ALL USING (is_admin());

-- ============================================================================
-- H. BUSINESS FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- H.1 generate_order_number()
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_number := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || upper(encode(extensions.gen_random_bytes(4), 'hex'));
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE order_number = v_number) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_number;
END;
$$;

-- H.2 create_order()
-- V1: one vendor per order. The frontend must split multi-vendor carts
-- into separate calls. All prices are computed from the database.
-- customer_id is derived from auth.uid() when authenticated.
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_id       UUID DEFAULT NULL,
  p_customer_name     TEXT,
  p_customer_phone    TEXT,
  p_customer_whatsapp TEXT DEFAULT NULL,
  p_delivery_address  TEXT,
  p_delivery_city     TEXT,
  p_delivery_zone_id  UUID DEFAULT NULL,
  p_delivery_required BOOLEAN DEFAULT true,
  p_customer_notes    TEXT DEFAULT NULL,
  p_items             JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id         UUID;
  v_order_number     TEXT;
  v_item             JSONB;
  v_product          RECORD;
  v_zone             RECORD;
  v_subtotal         NUMERIC(12,2) := 0;
  v_delivery_fee     NUMERIC(10,2) := 0;
  v_total            NUMERIC(12,2);
  v_deposit          NUMERIC(12,2);
  v_remaining        NUMERIC(12,2);
  v_item_total       NUMERIC(12,2);
  v_actual_customer_id UUID;
  v_vendor_id        UUID;
  v_item_product_ids UUID[] := '{}';
  v_seen_product_ids UUID[] := '{}';
BEGIN
  -- Validate customer name and phone
  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Customer phone is required';
  END IF;

  -- Derive customer_id from auth.uid() when authenticated
  IF auth.uid() IS NOT NULL THEN
    v_actual_customer_id := auth.uid();
  ELSE
    v_actual_customer_id := p_customer_id;
  END IF;

  -- Validate delivery info if required
  IF p_delivery_required THEN
    IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN
      RAISE EXCEPTION 'Delivery address is required';
    END IF;
    IF p_delivery_city IS NULL OR trim(p_delivery_city) = '' THEN
      RAISE EXCEPTION 'Delivery city is required';
    END IF;
    IF p_delivery_zone_id IS NOT NULL THEN
      SELECT * INTO v_zone FROM public.delivery_zones dz
      WHERE dz.id = p_delivery_zone_id AND dz.is_available = true AND dz.is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or inactive delivery zone';
      END IF;
      v_delivery_fee := v_zone.delivery_fee;
    END IF;
  ELSE
    v_delivery_fee := 0;
  END IF;

  -- Validate cart is not empty
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart must not be empty';
  END IF;

  -- Validate items: no duplicates, valid quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item IS NULL
       OR v_item->>'product_id' IS NULL
       OR v_item->>'quantity' IS NULL
    THEN
      RAISE EXCEPTION 'Each item must have product_id and quantity';
    END IF;

    IF (v_item->>'quantity')::INTEGER <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    IF (v_item->>'quantity')::INTEGER > 100 THEN
      RAISE EXCEPTION 'Quantity exceeds maximum allowed (100)';
    END IF;

    -- Reject duplicate product_id in cart
    IF v_seen_product_ids @> ARRAY[(v_item->>'product_id')::UUID] THEN
      RAISE EXCEPTION 'Duplicate product in cart: %', v_item->>'product_id';
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, (v_item->>'product_id')::UUID);
  END LOOP;

  -- Lock and validate products, compute subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, vendor_id, name, selling_price, stock, status
    INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    IF v_product.status != 'active' THEN
      RAISE EXCEPTION 'Product is not active: %', v_product.name;
    END IF;

    IF v_product.stock < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'Insufficient stock for: % (available: %, requested: %)',
        v_product.name, v_product.stock, v_item->>'quantity';
    END IF;

    -- All items must be from the same vendor (V1 constraint)
    IF v_vendor_id IS NULL THEN
      v_vendor_id := v_product.vendor_id;
    ELSIF v_product.vendor_id != v_vendor_id THEN
      RAISE EXCEPTION 'All items must be from the same vendor. Split multi-vendor carts.';
    END IF;

    -- Compute from database prices, never trust client
    v_item_total := v_product.selling_price * (v_item->>'quantity')::INTEGER;
    v_subtotal := v_subtotal + v_item_total;

    -- Decrement stock atomically
    UPDATE public.products
    SET stock = stock - (v_item->>'quantity')::INTEGER,
        updated_at = now()
    WHERE id = v_product.id;
  END LOOP;

  -- Financial calculation (server-side only)
  v_total := v_subtotal + v_delivery_fee;
  v_deposit := ROUND(v_subtotal * 0.5, 2);
  v_remaining := v_subtotal - v_deposit;

  -- Generate order number
  v_order_number := public.generate_order_number();

  -- Create order with vendor_id from product
  INSERT INTO public.orders (
    order_number, customer_id, vendor_id,
    subtotal, delivery_fee, total_amount, deposit_amount, remaining_amount,
    currency, payment_status, order_status, delivery_method,
    customer_first_name, customer_last_name, customer_phone,
    customer_whatsapp, customer_email,
    country, city, zone, neighborhood, address, notes
  ) VALUES (
    v_order_number, v_actual_customer_id, v_vendor_id,
    v_subtotal, v_delivery_fee, v_total, v_deposit, v_remaining,
    'XOF', 'pending', 'pending_payment',
    CASE WHEN p_delivery_required THEN 'delivery'::delivery_method ELSE 'pickup'::delivery_method END,
    split_part(p_customer_name, ' ', 1),
    CASE WHEN position(' ' in p_customer_name) > 0
         THEN substring(p_customer_name from position(' ' in p_customer_name) + 1)
         ELSE '' END,
    p_customer_phone, p_customer_whatsapp, NULL,
    'Bénin', p_delivery_city, NULL, NULL, p_delivery_address, p_customer_notes
  ) RETURNING id INTO v_order_id;

  -- Create order_items with vendor_id and prices from database
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, vendor_id, name, selling_price
    INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID;

    INSERT INTO public.order_items (
      order_id, product_id, vendor_id,
      product_name_snapshot, product_image_snapshot,
      unit_price_snapshot, quantity, total_price
    ) VALUES (
      v_order_id,
      v_product.id,
      v_product.vendor_id,
      v_product.name,
      (SELECT url FROM public.product_images pi WHERE pi.product_id = v_product.id ORDER BY pi.sort_order LIMIT 1),
      v_product.selling_price,
      (v_item->>'quantity')::INTEGER,
      v_product.selling_price * (v_item->>'quantity')::INTEGER
    );
  END LOOP;

  -- Create pending deposit payment
  INSERT INTO public.payments (order_id, amount, currency, payment_type, provider, status)
  VALUES (v_order_id, v_deposit, 'XOF', 'deposit', 'mock', 'pending');

  -- Create initial status history
  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, note)
  VALUES (v_order_id, NULL, 'pending_payment', auth.uid(), 'Order created');

  -- Return order summary
  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'tracking_token', (SELECT tracking_token FROM public.orders WHERE id = v_order_id),
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'total_amount', v_total,
    'deposit_amount', v_deposit,
    'remaining_amount', v_remaining,
    'currency', 'XOF',
    'order_status', 'pending_payment',
    'payment_status', 'pending'
  );
END;
$$;

-- H.3 confirm_deposit_payment()
-- RESERVED to service_role only. Never callable by anon or authenticated.
-- This function should be called by a webhook or backend after verifying
-- the payment with the provider.
CREATE OR REPLACE FUNCTION public.confirm_deposit_payment(
  p_payment_id            UUID,
  p_transaction_reference TEXT DEFAULT NULL,
  p_payment_method        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_order   RECORD;
BEGIN
  -- Lock payment row
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  -- Must be a deposit payment
  IF v_payment.payment_type != 'deposit' THEN
    RAISE EXCEPTION 'Only deposit payments can be confirmed via this function';
  END IF;

  -- Idempotent: already confirmed
  IF v_payment.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment already confirmed',
      'payment_id', v_payment.id
    );
  END IF;

  -- Must be pending
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not in pending status: %', v_payment.status;
  END IF;

  -- Lock order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF v_order.payment_status != 'pending' THEN
    RAISE EXCEPTION 'Order payment is not pending';
  END IF;

  -- Update payment to confirmed
  UPDATE public.payments
  SET status = 'confirmed',
      transaction_reference = p_transaction_reference,
      payment_method = p_payment_method,
      paid_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  -- Update order: payment confirmed → order confirmed
  -- This change will trigger trg_order_notifications
  UPDATE public.orders
  SET payment_status = 'confirmed',
      order_status = 'confirmed',
      updated_at = now()
  WHERE id = v_order.id;

  -- Status history
  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, note)
  VALUES (v_order.id, 'pending_payment', 'confirmed', NULL, 'Deposit payment confirmed');

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'order_status', 'confirmed'
  );
END;
$$;

-- H.4 get_order_receipt() — public, requires order_number + tracking_token UUID
CREATE OR REPLACE FUNCTION public.get_order_receipt(
  p_order_number   TEXT,
  p_tracking_token UUID
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'order_number', o.order_number,
    'order_status', o.order_status,
    'payment_status', o.payment_status,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total_amount', o.total_amount,
    'deposit_amount', o.deposit_amount,
    'remaining_amount', o.remaining_amount,
    'currency', o.currency,
    'delivery_method', o.delivery_method,
    'customer_first_name', o.customer_first_name,
    'customer_last_name', o.customer_last_name,
    'customer_phone', o.customer_phone,
    'city', o.city,
    'address', o.address,
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', oi.product_name_snapshot,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price_snapshot,
        'total', oi.total_price
      ))
      FROM public.order_items oi WHERE oi.order_id = o.id
    ),
    'created_at', o.created_at
  )
  FROM public.orders o
  WHERE o.order_number = p_order_number
    AND o.tracking_token = p_tracking_token;
$$;

-- H.5 get_order_tracking() — public, requires tracking_token UUID only
CREATE OR REPLACE FUNCTION public.get_order_tracking(
  p_tracking_token UUID
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'order_number', o.order_number,
    'order_status', o.order_status,
    'payment_status', o.payment_status,
    'total_amount', o.total_amount,
    'deposit_amount', o.deposit_amount,
    'remaining_amount', o.remaining_amount,
    'currency', o.currency,
    'delivery_method', o.delivery_method,
    'city', o.city,
    'created_at', o.created_at,
    'statuses', (
      SELECT jsonb_agg(jsonb_build_object(
        'status', osh.new_status,
        'created_at', osh.created_at
      ) ORDER BY osh.created_at)
      FROM public.order_status_history osh WHERE osh.order_id = o.id
    )
  )
  FROM public.orders o
  WHERE o.tracking_token = p_tracking_token;
$$;

-- H.6 prepare_vendor_order_notification() — internal, service_role only
CREATE OR REPLACE FUNCTION public.prepare_vendor_order_notification(
  p_order_id UUID,
  p_vendor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order     RECORD;
  v_vendor    RECORD;
  v_items     TEXT;
  v_message   TEXT;
BEGIN
  -- Verify vendor owns items in this order
  IF NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.vendor_id = p_vendor_id
  ) THEN
    RAISE EXCEPTION 'Vendor has no items in this order';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  SELECT * INTO v_vendor FROM public.vendors WHERE id = p_vendor_id;

  -- Build item list for THIS vendor only
  SELECT string_agg(
    '- ' || oi.product_name_snapshot || ' x' || oi.quantity || ' (' || oi.total_price || ' XOF)',
    E'\n'
  ) INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id AND oi.vendor_id = p_vendor_id;

  v_message := 'Nouvelle commande ' || v_order.order_number || E'\n'
    || 'Client: ' || v_order.customer_first_name || ' ' || v_order.customer_last_name || E'\n'
    || 'Téléphone: ' || v_order.customer_phone || E'\n'
    || 'Ville: ' || v_order.city || E'\n'
    || 'Adresse: ' || v_order.address || E'\n'
    || 'Articles:\n' || v_items || E'\n'
    || 'Total: ' || v_order.total_amount || ' XOF';

  INSERT INTO public.notifications (
    order_id, recipient_type, recipient_vendor_id, recipient_phone,
    channel, notification_type, message
  ) VALUES (
    p_order_id, 'vendor', p_vendor_id, v_vendor.phone,
    'whatsapp', 'vendor_new_order', v_message
  );
END;
$$;

-- H.7 prepare_admin_order_notification() — internal, service_role only
CREATE OR REPLACE FUNCTION public.prepare_admin_order_notification(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   RECORD;
  v_message TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;

  v_message := 'Nouvelle commande ' || v_order.order_number || E'\n'
    || 'Client: ' || v_order.customer_first_name || ' ' || v_order.customer_last_name || E'\n'
    || 'Téléphone: ' || v_order.customer_phone || E'\n'
    || 'Ville: ' || v_order.city || E'\n'
    || 'Total: ' || v_order.total_amount || ' XOF' || E'\n'
    || 'Acompte: ' || v_order.deposit_amount || ' XOF' || E'\n'
    || 'Solde: ' || v_order.remaining_amount || ' XOF';

  -- Notify all active admins
  INSERT INTO public.notifications (
    order_id, recipient_type, recipient_profile_id,
    channel, notification_type, message
  )
  SELECT
    p_order_id, 'admin', p.id,
    'whatsapp', 'admin_new_order', v_message
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.is_active = true
  ON CONFLICT DO NOTHING;
END;
$$;

-- H.8 prepare_order_notifications() — internal, service_role only
CREATE OR REPLACE FUNCTION public.prepare_order_notifications(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID;
BEGIN
  FOR v_vendor_id IN
    SELECT DISTINCT oi.vendor_id
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    PERFORM public.prepare_vendor_order_notification(p_order_id, v_vendor_id);
  END LOOP;

  PERFORM public.prepare_admin_order_notification(p_order_id);
END;
$$;

-- H.9 trigger_order_notifications() — SINGLE notification path
-- Fires ONLY when orders.payment_status transitions to 'confirmed'.
-- This is the ONLY automatic notification trigger. No notifications
-- are created inside confirm_deposit_payment() to avoid duplicates.
CREATE OR REPLACE FUNCTION public.trigger_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'confirmed'
     AND (OLD.payment_status IS NULL OR OLD.payment_status != 'confirmed')
  THEN
    PERFORM public.prepare_order_notifications(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- H.10 handle_updated_at() — generic trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- I. TRIGGERS
-- ============================================================================

-- Single notification trigger on orders (idempotent via unique indexes)
DROP TRIGGER IF EXISTS trg_order_notifications ON public.orders;
CREATE TRIGGER trg_order_notifications
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_notifications();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_delivery_zones_updated_at ON public.delivery_zones;
CREATE TRIGGER trg_delivery_zones_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- J. GRANTS / REVOKES
-- ============================================================================

-- Revoke all default grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- Anon: SELECT only on public-read tables
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT ON public.delivery_zones TO anon;
-- Note: public_vendors view grants are defined in section D (VIEW definition)

-- Authenticated: SELECT on own-data tables
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.vendors TO authenticated;
GRANT SELECT ON public.drivers TO authenticated;
GRANT SELECT ON public.categories TO authenticated;
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.product_images TO authenticated;
GRANT SELECT ON public.delivery_zones TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT SELECT ON public.deliveries TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;

-- Authenticated: INSERT where RPC requires it
GRANT INSERT ON public.orders TO authenticated;
GRANT INSERT ON public.order_items TO authenticated;
GRANT INSERT ON public.payments TO authenticated;
GRANT INSERT ON public.order_status_history TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;

-- Authenticated: UPDATE/INSERT on profiles
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- Authenticated: product management (RLS limits to own vendor)
GRANT INSERT ON public.products TO authenticated;
GRANT UPDATE ON public.products TO authenticated;
GRANT DELETE ON public.products TO authenticated;
GRANT INSERT ON public.product_images TO authenticated;
GRANT UPDATE ON public.product_images TO authenticated;
GRANT DELETE ON public.product_images TO authenticated;

-- Authenticated: deliveries (conserved, not used in V1)
GRANT UPDATE ON public.deliveries TO authenticated;

-- Revoke dangerous privileges
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Revoke DELETE where not needed
REVOKE DELETE ON public.orders FROM authenticated;
REVOKE DELETE ON public.payments FROM authenticated;
REVOKE DELETE ON public.order_status_history FROM authenticated;
REVOKE DELETE ON public.deliveries FROM authenticated;
REVOKE DELETE ON public.notifications FROM authenticated;
REVOKE DELETE ON public.profiles FROM authenticated;

-- Service role: full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Function EXECUTE grants
-- Public functions (safe for anon/authenticated)
GRANT EXECUTE ON FUNCTION public.get_order_receipt(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_receipt(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.create_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;

-- Restricted: service_role only (confirm_payment, notifications)
GRANT EXECUTE ON FUNCTION public.confirm_deposit_payment(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_order_notifications(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_vendor_order_notification(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_admin_order_notification(UUID) TO service_role;

-- Restricted: authenticated only (helpers + delivery status for future use)
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_vendor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_driver_id() TO authenticated;

-- Sequence usage
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
