import { createHmac } from 'crypto';
import {
  verifyMetaSignature,
  verifyMetaChallenge,
  normalizeToE164,
} from '@/lib/whatsapp-webhook';

const APP_SECRET = 'test_app_secret_123';

describe('verifyMetaSignature', () => {
  const originalSecret = process.env.WHATSAPP_APP_SECRET;

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = originalSecret;
  });

  it('accepts a valid HMAC-SHA256 signature', () => {
    const body = JSON.stringify({ entry: [{ id: '1' }] });
    const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex');
    expect(verifyMetaSignature(expected, body)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = JSON.stringify({ entry: [{ id: '1' }] });
    const signature = 'sha256=' + createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex');
    const tampered = JSON.stringify({ entry: [{ id: '2' }] });
    expect(verifyMetaSignature(signature, tampered)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyMetaSignature(null, '{}')).toBe(false);
  });

  it('rejects a missing app secret', () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const signature = 'sha256=' + createHmac('sha256', APP_SECRET).update('{}', 'utf8').digest('hex');
    expect(verifyMetaSignature(signature, '{}')).toBe(false);
  });

  it('rejects a wrong prefix', () => {
    const signature = createHmac('sha256', APP_SECRET).update('{}', 'utf8').digest('hex');
    expect(verifyMetaSignature(signature, '{}')).toBe(false);
  });

  it('rejects malformed hex (length mismatch)', () => {
    expect(verifyMetaSignature('sha256=abc', '{}')).toBe(false);
  });
});

describe('verifyMetaChallenge', () => {
  const originalToken = process.env.WHATSAPP_VERIFY_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token-123';
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = originalToken;
  });

  it('returns the challenge for a valid subscription request', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token-123',
      'hub.challenge': 'challenge-abc',
    });
    expect(verifyMetaChallenge(params)).toBe('challenge-abc');
  });

  it('rejects when mode is not subscribe', () => {
    const params = new URLSearchParams({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'verify-token-123',
      'hub.challenge': 'challenge-abc',
    });
    expect(verifyMetaChallenge(params)).toBeNull();
  });

  it('rejects when verify_token does not match', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-abc',
    });
    expect(verifyMetaChallenge(params)).toBeNull();
  });

  it('rejects when challenge is missing', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token-123',
    });
    expect(verifyMetaChallenge(params)).toBeNull();
  });

  it('rejects when VERIFY_TOKEN env is not set', () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token-123',
      'hub.challenge': 'challenge-abc',
    });
    expect(verifyMetaChallenge(params)).toBeNull();
  });
});

describe('normalizeToE164', () => {
  it('keeps a valid Beninese mobile number as-is', () => {
    expect(normalizeToE164('22996665142')).toBe('+22996665142');
  });

  it('adds Benin country code to local numbers', () => {
    expect(normalizeToE164('96665142')).toBe('+22996665142');
  });

  it('handles leading zero local format', () => {
    expect(normalizeToE164('01996665142')).toBe('+2291996665142');
  });

  it('strips non-digit characters', () => {
    expect(normalizeToE164('+229 96 66 51 42')).toBe('+22996665142');
  });
});