'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Flag, Globe } from 'lucide-react';

export interface PhoneCountry {
  code: string;           // ISO 3166-1 alpha-2 (e.g., 'BJ')
  name: string;           // Display name (e.g., 'Bénin')
  callingCode: string;    // International calling code without + (e.g., '229')
  flag: string;           // Emoji flag
  mask?: string;          // Optional input mask pattern
}

export interface PhoneInputProps {
  /** Field label */
  label?: string;
  /** Current phone value (without country code) */
  value: string;
  /** Callback when phone value changes */
  onChange: (phone: string, country: PhoneCountry) => void;
  /** Current selected country code (ISO alpha-2) */
  country?: string;
  /** Callback when country changes */
  onCountryChange?: (country: PhoneCountry) => void;
  /** Input placeholder */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Additional CSS classes */
  className?: string;
  /** Input name attribute */
  name?: string;
  /** Input id attribute */
  id?: string;
  /** Auto-complete attribute */
  autoComplete?: string;
  /** Whether to show country selector dropdown */
  showCountrySelector?: boolean;
  /** Custom countries list (defaults to African countries) */
  countries?: PhoneCountry[];
}

// Default African countries with calling codes
export const AFRICAN_COUNTRIES: PhoneCountry[] = [
  { code: 'BJ', name: 'Bénin', callingCode: '229', flag: '🇧🇯', mask: '## ## ## ##' },
  { code: 'CI', name: "Côte d'Ivoire", callingCode: '225', flag: '🇨🇮', mask: '## ## ## ##' },
  { code: 'TG', name: 'Togo', callingCode: '228', flag: '🇹🇬', mask: '## ## ## ##' },
  { code: 'SN', name: 'Sénégal', callingCode: '221', flag: '🇸🇳', mask: '## ## ## ##' },
  { code: 'GH', name: 'Ghana', callingCode: '233', flag: '🇬🇭', mask: '## ## ## ##' },
  { code: 'NG', name: 'Nigeria', callingCode: '234', flag: '🇳🇬', mask: '## ### ####' },
];

// Helper to find country by code
export function getCountryByCode(code: string, countries: PhoneCountry[] = AFRICAN_COUNTRIES): PhoneCountry | undefined {
  return countries.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

// Helper to format phone number for display
export function formatPhoneForDisplay(phone: string, country: PhoneCountry): string {
  const digits = phone.replace(/\D/g, '');
  if (!country.mask) return digits;
  
  let formatted = '';
  let digitIndex = 0;
  
  for (const char of country.mask) {
    if (char === '#') {
      if (digitIndex < digits.length) {
        formatted += digits[digitIndex];
        digitIndex++;
      } else {
        break;
      }
    } else {
      formatted += char;
    }
  }
  
  // Append remaining digits if any
  if (digitIndex < digits.length) {
    formatted += ' ' + digits.slice(digitIndex);
  }
  
  return formatted;
}

// Helper to parse phone number (extract digits only)
export function parsePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Helper to get full international format
export function getFullPhoneNumber(phone: string, country: PhoneCountry): string {
  const digits = parsePhoneNumber(phone);
  if (!digits) return '';
  return `+${country.callingCode} ${formatPhoneForDisplay(digits, country)}`;
}

export default function PhoneInput({
  label,
  value,
  onChange,
  country: controlledCountry,
  onCountryChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  className = '',
  name,
  id,
  autoComplete = 'tel',
  showCountrySelector = true,
  countries = AFRICAN_COUNTRIES,
}: PhoneInputProps) {
  // Internal state for uncontrolled country
  const [internalCountry, setInternalCountry] = useState<PhoneCountry>(
    () => getCountryByCode(controlledCountry || 'BJ', countries) || countries[0]
  );
  
  // Determine active country (controlled or internal)
  const activeCountry = controlledCountry
    ? getCountryByCode(controlledCountry, countries) || internalCountry
    : internalCountry;
  
  // Sync internal state when controlled country changes
  useEffect(() => {
    if (controlledCountry) {
      const found = getCountryByCode(controlledCountry, countries);
      if (found && found.code !== internalCountry.code) {
        setInternalCountry(found);
      }
    }
  }, [controlledCountry, countries, internalCountry]);

  // Handle phone input change - strip non-digits
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = parsePhoneNumber(e.target.value);
    onChange(digits, activeCountry);
  }, [onChange, activeCountry]);

  // Handle country selector
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredCountries = useMemo(() => {
    if (!searchQuery) return countries;
    const query = searchQuery.toLowerCase();
    return countries.filter(
      (c) => c.name.toLowerCase().includes(query) || c.callingCode.includes(query)
    );
  }, [countries, searchQuery]);

  const handleCountrySelect = useCallback((country: PhoneCountry) => {
    setInternalCountry(country);
    onCountryChange?.(country);
    setCountryDropdownOpen(false);
    setSearchQuery('');
  }, [onCountryChange]);

  // Format value for display in input (with spacing)
  const displayValue = formatPhoneForDisplay(value, activeCountry);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-rose-500" aria-hidden="true">*</span>}
        </label>
      )}
      
      <div className="relative">
        {/* Country selector button */}
        {showCountrySelector && (
          <div className="absolute left-0 top-0 bottom-0 flex items-center border-r border-primary-200 bg-primary-50 rounded-l-lg z-10">
            <button
              type="button"
              onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
              disabled={disabled}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-900 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:border-transparent transition-colors rounded-l-lg"
              aria-label="Sélectionner le pays"
              aria-expanded={countryDropdownOpen}
              aria-haspopup="listbox"
            >
              <span className="text-base" aria-hidden="true">{activeCountry.flag}</span>
              <span className="font-medium">+{activeCountry.callingCode}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            
            {/* Country dropdown */}
            {countryDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setCountryDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-primary-100 py-2 z-50 overflow-hidden">
                  <div className="p-2 border-b border-primary-100">
                    <label htmlFor="country-search" className="sr-only">Rechercher un pays</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                      <input
                        id="country-search"
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher…"
                        autoFocus
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-primary-50 border border-primary-200 text-sm text-gray-900 placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredCountries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                          c.code === activeCountry.code
                            ? 'bg-red-50 text-red-700 font-medium'
                            : 'text-gray-700 hover:bg-primary-50'
                        }`}
                        role="option"
                        aria-selected={c.code === activeCountry.code}
                      >
                        <span aria-hidden="true">{c.flag}</span>
                        <span className="flex-1">{c.name}</span>
                        <span className="text-gray-500 font-mono">+{c.callingCode}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Phone input */}
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          value={displayValue}
          onChange={handlePhoneChange}
          onFocus={(e) => {
            // Position cursor at end of formatted value
            setTimeout(() => {
              e.currentTarget.setSelectionRange(displayValue.length, displayValue.length);
            }, 0);
          }}
          placeholder={placeholder || (activeCountry.mask ? activeCountry.mask.replace(/#/g, '0') : '')}
          className={`w-full ${
            showCountrySelector ? 'pl-[80px]' : 'pl-4'
          } pr-4 py-3 rounded-lg border border-primary-200 bg-white text-[#1A1919] placeholder-gray-400 
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 
          focus-visible:border-transparent transition-colors
          ${error ? 'border-rose-300 focus-visible:ring-rose-300' : ''}
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        
        {/* Country code prefix display when selector is hidden */}
        {!showCountrySelector && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none" aria-hidden="true">
            +{activeCountry.callingCode}
          </span>
        )}
      </div>
      
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Re-export helpers (already exported above, this line removed to avoid duplicate exports)