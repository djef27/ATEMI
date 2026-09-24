-- ============================================================================
-- UPDATE create_order: per-product deposit_rate + fix order_items columns
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name     TEXT,
  p_customer_phone    TEXT,
  p_delivery_address  TEXT,
  p_delivery_city     TEXT,
  p_items             JSONB,
  p_customer_whatsapp TEXT DEFAULT NULL,
  p_delivery_zone_id  UUID DEFAULT NULL,
  p_delivery_required BOOLEAN DEFAULT true,
  p_customer_notes    TEXT DEFAULT NULL,
  p_customer_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id           UUID;
  v_order_number       TEXT;
  v_item               JSONB;
  v_product            RECORD;
  v_zone               RECORD;
  v_subtotal           NUMERIC(12,2) := 0;
  v_delivery_fee       NUMERIC(10,2) := 0;
  v_total              NUMERIC(12,2);
  v_deposit            NUMERIC(12,2) := 0;
  v_remaining          NUMERIC(12,2);
  v_item_total         NUMERIC(12,2);
  v_item_deposit       NUMERIC(12,2);
  v_item_remaining     NUMERIC(12,2);
  v_actual_customer_id UUID;
  v_vendor_id          UUID;
  v_seen_product_ids   UUID[] := '{}';
BEGIN
  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Customer phone is required';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_actual_customer_id := auth.uid();
  ELSE
    v_actual_customer_id := p_customer_id;
  END IF;

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

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart must not be empty';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item IS NULL OR v_item->>'product_id' IS NULL OR v_item->>'quantity' IS NULL THEN
      RAISE EXCEPTION 'Each item must have product_id and quantity';
    END IF;
    IF (v_item->>'quantity')::INTEGER <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive';
    END IF;
    IF (v_item->>'quantity')::INTEGER > 100 THEN
      RAISE EXCEPTION 'Quantity exceeds maximum allowed (100)';
    END IF;
    IF v_seen_product_ids @> ARRAY[(v_item->>'product_id')::UUID] THEN
      RAISE EXCEPTION 'Duplicate product in cart: %', v_item->>'product_id';
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, (v_item->>'product_id')::UUID);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, vendor_id, name, selling_price, deposit_rate, stock, status
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
    IF v_vendor_id IS NULL THEN
      v_vendor_id := v_product.vendor_id;
    ELSIF v_product.vendor_id != v_vendor_id THEN
      RAISE EXCEPTION 'All items must be from the same vendor. Split multi-vendor carts.';
    END IF;

    v_item_total := v_product.selling_price * (v_item->>'quantity')::INTEGER;
    v_item_deposit := ROUND(v_product.selling_price * v_product.deposit_rate / 100, 2) * (v_item->>'quantity')::INTEGER;
    v_subtotal := v_subtotal + v_item_total;
    v_deposit := v_deposit + v_item_deposit;

    UPDATE public.products
    SET stock = stock - (v_item->>'quantity')::INTEGER,
        updated_at = now()
    WHERE id = v_product.id;
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;
  v_remaining := v_subtotal - v_deposit;
  v_order_number := public.generate_order_number();

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, vendor_id, name, selling_price, deposit_rate
    INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID;

    v_item_total := v_product.selling_price * (v_item->>'quantity')::INTEGER;
    v_item_deposit := ROUND(v_product.selling_price * v_product.deposit_rate / 100, 2) * (v_item->>'quantity')::INTEGER;
    v_item_remaining := v_item_total - v_item_deposit;

    INSERT INTO public.order_items (
      order_id, product_id, vendor_id,
      product_name, unit_price, quantity, line_total,
      deposit_rate_snapshot, deposit_amount_snapshot, remaining_amount_snapshot
    ) VALUES (
      v_order_id,
      v_product.id,
      v_product.vendor_id,
      v_product.name,
      v_product.selling_price,
      (v_item->>'quantity')::INTEGER,
      v_item_total,
      v_product.deposit_rate,
      v_item_deposit,
      v_item_remaining
    );
  END LOOP;

  INSERT INTO public.payments (order_id, amount, currency, payment_type, provider, status)
  VALUES (v_order_id, v_deposit, 'XOF', 'deposit', 'mock', 'pending');

  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, note)
  VALUES (v_order_id, NULL, 'pending_payment', auth.uid(), 'Order created');

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
