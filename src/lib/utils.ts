export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
}

/** Fallback deposit rate (%) — mirrors the SQL column default `deposit_rate = 50`. */
export const DEFAULT_DEPOSIT_RATE = 50;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Constrains a post-login redirect to a same-origin path.
 *
 * Anything absolute (`https://evil.tld`), protocol-relative (`//evil.tld`) or
 * backslash-escaped (`/\evil.tld`) falls back to the home page, so a crafted
 * `?redirect=` cannot turn the login page into an open redirect used for
 * phishing after a successful sign-in.
 */
export function sanitizeRedirect(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith('/')) return fallback;
  // `//host` and `/\host` are protocol-relative URLs, not local paths.
  if (candidate[1] === '/' || candidate[1] === '\\') return fallback;
  return candidate;
}

export function escapeLike(value: string): string {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Deposit split for a product price.
 *
 * Mirrors the SQL in `create_order`:
 *   deposit   = round(selling_price * deposit_rate / 100, 2)
 *   remaining = selling_price - deposit
 *
 * The server always recomputes these values, so any client-side computation is
 * only for display — it must never diverge from the SQL above.
 */
export function computeDepositAmounts(
  sellingPrice: number,
  depositRate: number | null | undefined
): { deposit_amount: number; remaining_amount: number } {
  const rate = depositRate ?? DEFAULT_DEPOSIT_RATE;
  const deposit_amount = Math.round(sellingPrice * rate / 100);
  return {
    deposit_amount,
    remaining_amount: sellingPrice - deposit_amount,
  };
}

/**
 * Escapes a value for interpolation into an HTML template body or attribute.
 * Order matters: `&` first, otherwise the ampersands introduced by the other
 * replacements would be double-escaped.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
