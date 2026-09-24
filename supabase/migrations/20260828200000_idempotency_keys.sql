-- ============================================================================
-- Idempotency table for financial operations
-- Provides persistent, cross-instance idempotency for payment confirmations,
-- order creation, and webhook processing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    idempotency_key   TEXT PRIMARY KEY,
    -- Who/what is making the request
    requester_type    TEXT NOT NULL CHECK (requester_type IN ('admin', 'webhook', 'customer', 'system')),
    requester_id      TEXT NOT NULL,
    -- Request fingerprint to detect same key with different payload
    request_hash      TEXT NOT NULL,
    -- HTTP method + path for additional context
    request_method    TEXT NOT NULL,
    request_path      TEXT NOT NULL,
    -- Response stored for replay
    response_status   INTEGER,
    response_body     JSONB,
    -- Metadata
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    processed_at      TIMESTAMPTZ
);

-- Index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
    ON public.idempotency_keys (expires_at);

-- Index for lookup by requester
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_requester
    ON public.idempotency_keys (requester_type, requester_id);

-- RLS: Only service_role can access (via admin client)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Admin can read all
CREATE POLICY idempotency_admin_all
    ON public.idempotency_keys
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Service role has full access (via admin client with service_role key)
-- No policy needed for service_role as it bypasses RLS

-- Function to check and store idempotency key atomically
-- Returns: (is_new, existing_response_jsonb)
CREATE OR REPLACE FUNCTION public.check_idempotency_key(
    p_key           TEXT,
    p_requester_type TEXT,
    p_requester_id   TEXT,
    p_request_hash   TEXT,
    p_request_method TEXT,
    p_request_path   TEXT
) RETURNS TABLE (
    is_new BOOLEAN,
    existing_response JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_existing record;
BEGIN
    -- Try to insert new key
    INSERT INTO public.idempotency_keys (
        idempotency_key,
        requester_type,
        requester_id,
        request_hash,
        request_method,
        request_path
    ) VALUES (
        p_key,
        p_requester_type,
        p_requester_id,
        p_request_hash,
        p_request_method,
        p_request_path
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING idempotency_key INTO v_existing;

    IF v_existing IS NOT NULL THEN
        -- New key inserted successfully
        RETURN QUERY SELECT true, NULL::jsonb;
    ELSE
        -- Key already exists, fetch existing response
        SELECT response_body
        INTO existing_response
        FROM public.idempotency_keys
        WHERE idempotency_key = p_key;

        -- Verify request hash matches (prevent same key with different payload)
        IF (SELECT request_hash FROM public.idempotency_keys WHERE idempotency_key = p_key) <> p_request_hash THEN
            RAISE EXCEPTION 'Idempotency key reuse with different request payload';
        END IF;

        RETURN QUERY SELECT false, existing_response;
    END IF;
END;
$$;

-- Function to store response after processing
CREATE OR REPLACE FUNCTION public.store_idempotency_response(
    p_key           TEXT,
    p_response_status INTEGER,
    p_response_body   JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.idempotency_keys
    SET
        response_status = p_response_status,
        response_body = p_response_body,
        processed_at = now()
    WHERE idempotency_key = p_key;
END;
$$;

-- Cleanup function for expired keys (run via pg_cron or scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.idempotency_keys
    WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- Grant execute to service_role only
REVOKE EXECUTE ON FUNCTION public.check_idempotency_key(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.store_idempotency_response(text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_idempotency_keys() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_idempotency_key(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_idempotency_response(text, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_idempotency_keys() TO service_role;