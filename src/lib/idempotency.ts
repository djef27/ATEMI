import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

export interface IdempotencyCheckResult {
  isNew: boolean;
  existingResponse?: unknown;
  error?: string;
}

export interface IdempotencyContext {
  requesterType: 'admin' | 'webhook' | 'customer' | 'system';
  requesterId: string;
  requestMethod: string;
  requestPath: string;
}

/**
 * Generate a deterministic hash of the request body for idempotency checking.
 * Uses SHA-256 for collision resistance.
 */
export function generateRequestHash(body: unknown): string {
  const obj = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  const normalized = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check idempotency key atomically in the database.
 * Returns { isNew: true } if this is a new request.
 * Returns { isNew: false, existingResponse } if the key was already processed.
 * Throws if same key used with different payload.
 */
export async function checkIdempotencyKey(
  idempotencyKey: string,
  context: IdempotencyContext,
  requestHash: string
): Promise<IdempotencyCheckResult> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase.rpc('check_idempotency_key', {
    p_key: idempotencyKey,
    p_requester_type: context.requesterType,
    p_requester_id: context.requesterId,
    p_request_hash: requestHash,
    p_request_method: context.requestMethod,
    p_request_path: context.requestPath,
  });

  if (error) {
    // Check for our custom exception
    if (error.message?.includes('Idempotency key reuse with different request payload')) {
      return { isNew: false, error: 'IDEMPOTENCY_KEY_CONFLICT' };
    }
    return { isNew: false, error: error.message };
  }

  const result = data?.[0];
  if (!result) {
    return { isNew: false, error: 'Unexpected response from idempotency check' };
  }

  return {
    isNew: result.is_new,
    existingResponse: result.existing_response,
  };
}

/**
 * Store the response for an idempotency key after successful processing.
 */
export async function storeIdempotencyResponse(
  idempotencyKey: string,
  status: number,
  body: unknown
): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.rpc('store_idempotency_response', {
    p_key: idempotencyKey,
    p_response_status: status,
    p_response_body: body,
  });

  if (error) {
    // Log but don't throw - idempotency storage failure shouldn't break the main flow
    console.error('Failed to store idempotency response:', error);
  }
}

/**
 * Middleware helper to extract or generate idempotency key from request.
 * Priority: Idempotency-Key header > generated from method + URL (+ body hash).
 *
 * The fallback must include a body hash: an URL-only key would collapse two
 * genuinely different POSTs to the same endpoint into one bucket, which the
 * idempotency RPC then rejects as a payload conflict (409) even though no
 * replay occurred. Including the hash keeps distinct payloads distinct while
 * still making an identical retry a replay.
 */
export function getIdempotencyKey(request: Request, fallbackPrefix: string, body?: unknown): string {
  const headerKey = request.headers.get('idempotency-key');
  if (headerKey) {
    return headerKey;
  }
  const base = `${fallbackPrefix}:${request.method}:${request.url}`;
  return body === undefined ? base : `${base}:${generateRequestHash(body)}`;
}
