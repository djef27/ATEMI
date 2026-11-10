import {
  getGeographicCities,
  getGeographicCountries,
  getGeographicSubdivisions,
  isGeographicCountry,
} from '@/lib/geography-data';
import { groupCountriesByContinent } from '@/lib/geography';

describe('global checkout geography dataset', () => {
  it('provides unique valid ISO country codes with French and international labels', () => {
    const countries = getGeographicCountries();
    const codes = countries.map((country) => country.code);

    expect(countries.length).toBeGreaterThan(200);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
    expect(countries.find((country) => country.code === 'CI')).toMatchObject({
      name: "Côte d'Ivoire",
      internationalName: expect.any(String),
      callingCode: '225',
      continent: 'Afrique',
    });
    expect(countries.find((country) => country.code === 'SG')).toMatchObject({
      name: 'Singapour',
      callingCode: '65',
      continent: 'Asie',
    });
    expect(groupCountriesByContinent(countries).some((group) => group.label.includes("Afrique de l'Ouest"))).toBe(true);
  });

  it.each([
    ['BJ', 'LI', 'Cotonou', '229'],
    ['CI', 'AB', 'Abidjan', '225'],
    ['TG', 'M', 'Lomé', '228'],
    ['GH', 'AA', 'Accra', '233'],
    ['NG', 'LA', 'Lagos', '234'],
    ['SN', 'DK', 'Dakar', '221'],
    ['CM', 'LT', 'Douala', '237'],
    ['FR', 'IDF', 'Paris', '33'],
    ['ES', 'MD', 'Madrid', '34'],
    ['SG', '01', 'Singapore', '65'],
  ])('loads %s subdivisions, cities, and phone prefix from the dataset', (
    countryCode,
    regionCode,
    expectedCity,
    callingCode
  ) => {
    const country = getGeographicCountries().find((item) => item.code === countryCode);
    const subdivisions = getGeographicSubdivisions(countryCode);
    const cities = getGeographicCities(countryCode, regionCode);

    expect(country).toBeDefined();
    expect(country?.callingCode).toBe(callingCode);
    expect(subdivisions.some((region) => region.code === regionCode)).toBe(true);
    expect(cities.some((city) => city.name === expectedCity)).toBe(true);
    expect(cities.every((city) => city.id.startsWith(`${countryCode}-${regionCode}-`))).toBe(true);
    expect(subdivisions.every((region) => !/(Department|Region| State| Province)$/i.test(region.name))).toBe(true);
  });

  it('returns no invented subdivisions or cities when the source has none', () => {
    expect(getGeographicSubdivisions('GF')).toEqual([]);
    expect(getGeographicCities('GF')).toEqual([]);
  });

  it('rejects unknown ISO-shaped country codes on the server', () => {
    expect(isGeographicCountry('ZZ')).toBe(false);
    expect(isGeographicCountry('FR')).toBe(true);
    expect(isGeographicCountry('fr')).toBe(false);
    expect(isGeographicCountry(null)).toBe(false);
  });

  it('does not return another country’s localities for an identical region code', () => {
    expect(getGeographicCities('TG', 'M').map((city) => city.name)).toContain('Lomé');
    expect(getGeographicCities('TG', 'M').map((city) => city.name)).not.toContain('Cotonou');
    expect(getGeographicCities('GH', 'AA').map((city) => city.name)).toContain('Accra');
  });
});
