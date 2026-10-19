/**
 * Centralized site configuration for Atémi.
 * All contact information, social links, and site-wide constants are defined here.
 * This ensures consistency across all pages and makes updates trivial.
 */

export interface SiteContactConfig {
  /** General platform contact phone (E.164 format without +) */
  phone: string;
  /** Phone in display format with spaces */
  phoneDisplay: string;
  /** WhatsApp URL for the general contact */
  whatsappUrl: string;
  /** General contact email (may be empty if not configured) */
  email: string;
  /** Physical address */
  address: string;
  /** City */
  city: string;
  /** Country */
  country: string;
}

/** Default contact configuration - replace with actual values when confirmed */
export const DEFAULT_CONTACT_CONFIG: SiteContactConfig = {
  phone: '22944336178',           // E.164: +229 44 33 61 78
  phoneDisplay: '+229 44 33 61 78',
  whatsappUrl: 'https://wa.me/22944336178',
  email: '',                      // Not yet confirmed - will be contact@atemi.com when ready
  address: 'Cotonou',
  city: 'Cotonou',
  country: 'Bénin',
};

/** Get contact config with environment variable overrides */
export function getContactConfig(): SiteContactConfig {
  // Environment variables can override defaults
  const envPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.replace(/[^\d]/g, '');
  const envEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const envAddress = process.env.NEXT_PUBLIC_CONTACT_ADDRESS;
  const envCity = process.env.NEXT_PUBLIC_CONTACT_CITY;
  const envCountry = process.env.NEXT_PUBLIC_CONTACT_COUNTRY;

  const phone = envPhone || DEFAULT_CONTACT_CONFIG.phone;
  const phoneDisplay = phone.length >= 10
    ? `+${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5, 7)} ${phone.slice(7, 9)}`
    : DEFAULT_CONTACT_CONFIG.phoneDisplay;

  return {
    phone,
    phoneDisplay,
    whatsappUrl: `https://wa.me/${phone}`,
    email: envEmail || DEFAULT_CONTACT_CONFIG.email,
    address: envAddress || DEFAULT_CONTACT_CONFIG.address,
    city: envCity || DEFAULT_CONTACT_CONFIG.city,
    country: envCountry || DEFAULT_CONTACT_CONFIG.country,
  };
}

/** Site metadata */
export const SITE_METADATA = {
  name: 'Atémi',
  description: 'Une marketplace qui met en lumière les vendeurs et les créations d\'Afrique.',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://atemi.com',
  defaultCountry: 'BJ' as const,
  supportedCountries: ['BJ', 'CI', 'TG', 'SN', 'GH', 'NG'] as const,
} as const;

/** Currency configuration */
export const CURRENCY = {
  code: 'XOF' as const,
  symbol: 'FCFA',
  locale: 'fr-FR',
} as const;

/** Format price in XOF */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency: CURRENCY.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format phone for display (with country code formatting) */
export function formatPhoneForDisplay(phone: string, countryCode: string = '229'): string {
  const digits = phone.replace(/\D/g, '');
  const callingCode = countryCode;
  
  // Format based on country
  switch (callingCode) {
    case '229': // Bénin
    case '225': // Côte d'Ivoire
    case '228': // Togo
    case '221': // Sénégal
      if (digits.length === 8) {
        return `+${callingCode} ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
      }
      break;
    case '233': // Ghana
    case '234': // Nigeria
      if (digits.length === 9) {
        return `+${callingCode} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
      }
      break;
  }
  
  // Fallback
  return `+${callingCode} ${digits}`;
}

/** Parse phone number to extract digits only */
export function parsePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Get full international format from national number and country code */
export function getFullPhoneNumber(nationalNumber: string, callingCode: string): string {
  const digits = nationalNumber.replace(/\D/g, '');
  return `+${callingCode} ${formatPhoneForDisplay(digits, callingCode).replace(`+${callingCode} `, '')}`;
}