import fs from 'fs';
import path from 'path';
import { deliveryZoneCreateSchema, deliveryZoneUpdateSchema } from '@/lib/validations';
import { normalizeCity, isSupportedCountry } from '@/lib/delivery-zones';

describe('Security: Delivery zones', () => {
  it('only normalizes legacy Benin country labels in the Benin seed migration', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260924000000_delivery_zones_benin_v2.sql'),
      'utf-8'
    );

    expect(migration).toMatch(
      /UPDATE public\.delivery_zones\s+SET country = 'BJ'\s+WHERE lower\(btrim\(country\)\) IN \('bénin', 'benin'\)/i
    );
    expect(migration).not.toMatch(/WHERE country\s*<>\s*'BJ'/i);
  });

  it('deduplicates equivalent zones without discarding referenced order zones', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261108140000_normalize_delivery_zone_duplicates.sql'),
      'utf-8'
    );

    expect(migration).toContain('city_name_normalized');
    expect(migration).toContain('zone_name_normalized');
    expect(migration).toContain('UPDATE public.orders');
    expect(migration).toContain('CREATE UNIQUE INDEX');
    expect(migration).toMatch(/UPDATE public\.orders[\s\S]*DELETE FROM public\.delivery_zones/i);
    expect(migration).toMatch(/RAISE EXCEPTION[\s\S]*Ambiguous/i);
  });

  describe('deliveryZoneCreateSchema', () => {
    it('accepts a valid zone', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: 'Cotonou',
        zone_name: 'Akpakpa',
        delivery_fee: 2000,
      });
      expect(result.success).toBe(true);
    });

    it('accepts country default BJ', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: 'Parakou',
        zone_name: 'Centre-Ville',
        delivery_fee: 2500,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBe('BJ');
      }
    });

    it('accepts explicit valid country', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        country: 'TG',
        city: 'Lomé',
        zone_name: 'Centre',
        delivery_fee: 1500,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty city', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: '   ',
        zone_name: 'Centre',
        delivery_fee: 1000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty zone_name', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: 'Cotonou',
        zone_name: '',
        delivery_fee: 1000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative delivery_fee', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: 'Cotonou',
        zone_name: 'Agla',
        delivery_fee: -500,
      });
      expect(result.success).toBe(false);
    });

    it('rejects huge delivery_fee', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: 'Cotonou',
        zone_name: 'Agla',
        delivery_fee: 5_000_000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects country longer than 2 chars', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        country: 'BENIN',
        city: 'Cotonou',
        zone_name: 'Agla',
        delivery_fee: 1000,
      });
      expect(result.success).toBe(false);
    });

    it('allows SQL-looking strings (queries are parameterized — no injection)', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: "'; DROP TABLE delivery_zones; --",
        zone_name: "1' OR '1'='1",
        delivery_fee: 1000,
      });
      // Supabase queries use bound parameters, so arbitrary text is safe.
      // The length limits are the only string constraint needed here.
      expect(result.success).toBe(true);
    });

    it('rejects non-numeric delivery_fee', () => {
      const result = deliveryZoneCreateSchema.safeParse({
        city: 'Cotonou',
        zone_name: 'Agla',
        delivery_fee: 'hacker',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('deliveryZoneUpdateSchema', () => {
    it('accepts a single-field patch', () => {
      const result = deliveryZoneUpdateSchema.safeParse({ delivery_fee: 3000 });
      expect(result.success).toBe(true);
    });

    it('accepts a full update', () => {
      const result = deliveryZoneUpdateSchema.safeParse({
        city: 'Bohicon',
        zone_name: 'Agongblan',
        delivery_fee: 2500,
        is_available: false,
        is_active: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative delivery_fee', () => {
      const result = deliveryZoneUpdateSchema.safeParse({ delivery_fee: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects empty zone_name', () => {
      const result = deliveryZoneUpdateSchema.safeParse({ zone_name: '  ' });
      expect(result.success).toBe(false);
    });

    it('rejects non-boolean flags', () => {
      const result = deliveryZoneUpdateSchema.safeParse({ is_active: 'yes' });
      expect(result.success).toBe(false);
    });
  });

  describe('normalizeCity', () => {
    it('removes accents and lowercases', () => {
      expect(normalizeCity('Cotonou')).toBe('cotonou');
      expect(normalizeCity('Comè')).toBe('come');
      expect(normalizeCity('Sèmè-Podji')).toBe('seme-podji');
      expect(normalizeCity('Cadjèhè')).toBe('cadjehe');
    });

    it('trims whitespace and collapses inner spaces', () => {
      expect(normalizeCity('  Abomey-Calavi  ')).toBe('abomey-calavi');
      expect(normalizeCity('Porto   Novo')).toBe('porto novo');
    });

    it('handles combined diacritics (NFD)', () => {
      const combined = 'S' + String.fromCharCode(0x65, 0x0300) + 'm' + String.fromCharCode(0x65, 0x0300);
      expect(normalizeCity(combined)).toBe('seme');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(normalizeCity('   ')).toBe('');
    });
  });

  describe('isSupportedCountry', () => {
    it('accepts ISO-shaped uppercase country codes for geographic validation by API routes', () => {
      expect(isSupportedCountry('BJ')).toBe(true);
      expect(isSupportedCountry('CI')).toBe(true);
      expect(isSupportedCountry('TG')).toBe(true);
      expect(isSupportedCountry('GH')).toBe(true);
      expect(isSupportedCountry('SG')).toBe(true);
      expect(isSupportedCountry('FR')).toBe(true);
    });

    it('rejects malformed or missing country codes', () => {
      expect(isSupportedCountry('')).toBe(false);
      expect(isSupportedCountry(null)).toBe(false);
      expect(isSupportedCountry('ben')).toBe(false);
      expect(isSupportedCountry('fr')).toBe(false);
    });
  });
});