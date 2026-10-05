import { deliveryZoneCreateSchema, deliveryZoneUpdateSchema } from '@/lib/validations';
import { normalizeCity, isSupportedCountry } from '@/lib/delivery-zones';

describe('Security: Delivery zones', () => {
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
    it('accepts BJ, CI, TG', () => {
      expect(isSupportedCountry('BJ')).toBe(true);
      expect(isSupportedCountry('CI')).toBe(true);
      expect(isSupportedCountry('TG')).toBe(true);
    });

    it('rejects unknown or malformed countries', () => {
      expect(isSupportedCountry('FR')).toBe(false);
      expect(isSupportedCountry('')).toBe(false);
      expect(isSupportedCountry(null)).toBe(false);
      expect(isSupportedCountry('ben')).toBe(false);
    });
  });
});