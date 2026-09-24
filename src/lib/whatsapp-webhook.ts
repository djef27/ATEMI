/**
 * Meta WhatsApp Cloud API webhook helpers.
 *
 * Meta sends:
 *   - GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...  (verification)
 *   - POST with header `X-Hub-Signature-256: sha256=<hex>`              (events)
 *
 * The signature is an HMAC-SHA256 of the RAW request body using the
 * WHATSAPP_APP_SECRET. Never parse the body before verifying it.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify the X-Hub-Signature-256 header for an incoming Meta webhook POST.
 * `rawBody` MUST be the exact raw request body.
 */
export function verifyMetaSignature(
  signatureHeader: string | null,
  rawBody: string,
  expectedPrefix = 'sha256='
): boolean {
  if (!signatureHeader) return false;
  if (!signatureHeader.startsWith(expectedPrefix)) return false;

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return false;

  const provided = signatureHeader.slice(expectedPrefix.length);
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Validate the GET verification request from Meta.
 * Returns the hub.challenge string if valid, otherwise null.
 */
export function verifyMetaChallenge(params: URLSearchParams): string | null {
  const mode = params.get('hub.mode');
  const verifyToken = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode !== 'subscribe') return null;
  if (!challenge) return null;

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expectedToken) return null;

  if (verifyToken !== expectedToken) return null;

  return challenge;
}

/**
 * Normalise a phone number to the E.164 form Meta expects for lookups.
 * Meta stores WhatsApp numbers as digits (country code + number).
 */
export function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('229') && digits.length === 11) return `+${digits}`;
  if (!digits.startsWith('0') && digits.length >= 10) return `+${digits}`;
  return `+229${digits.replace(/^0/, '')}`;
}