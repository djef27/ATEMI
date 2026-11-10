import { City, Country, State } from 'country-state-city';
import worldCountries from 'world-countries';
import type { GeographyCountry, GeographyCity, GeographySubdivision } from '@/lib/geography';
import { normalizeCity } from '@/lib/delivery-zones';

const countriesByCode = new Map(worldCountries.map((country) => [country.cca2, country]));
const frenchDisplayNames = new Intl.DisplayNames(['fr'], { type: 'region' });

const continentNames: Record<string, string> = {
  Africa: 'Afrique',
  Asia: 'Asie',
  Europe: 'Europe',
  Americas: 'Amériques',
  Oceania: 'Océanie',
  Antarctic: 'Antarctique',
};

const subregionNames: Record<string, string> = {
  'Australia and New Zealand': 'Australie et Nouvelle-Zélande',
  'Central America': 'Amérique centrale',
  'Central Asia': 'Asie centrale',
  'Eastern Africa': "Afrique de l'Est",
  'Eastern Asia': "Asie de l'Est",
  'Eastern Europe': 'Europe de l’Est',
  'Melanesia': 'Mélanésie',
  'Micronesia': 'Micronésie',
  'Middle Africa': 'Afrique centrale',
  'Northern Africa': 'Afrique du Nord',
  'Northern America': 'Amérique du Nord',
  'Northern Europe': 'Europe du Nord',
  'Polynesia': 'Polynésie',
  'South America': 'Amérique du Sud',
  'South-Eastern Asia': 'Asie du Sud-Est',
  'Southern Africa': 'Afrique australe',
  'Southern Asia': 'Asie du Sud',
  'Southern Europe': 'Europe du Sud',
  'Western Africa': "Afrique de l'Ouest",
  'Western Asia': "Asie de l'Ouest",
  'Western Europe': 'Europe de l’Ouest',
};

function stableSlug(value: string): string {
  return normalizeCity(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'localite';
}

function callingCodeFor(code: string): string {
  const callingCode = Country.getCountryByCode(code)?.phonecode || '';
  return callingCode.replace(/\D/g, '');
}

export function isGeographicCountry(code: string | null | undefined): code is string {
  return Boolean(code && /^[A-Z]{2}$/.test(code) && countriesByCode.has(code) && Country.getCountryByCode(code));
}

export function getGeographicCountries(): GeographyCountry[] {
  return worldCountries
    .filter((country) => Country.getCountryByCode(country.cca2))
    .map((country) => {
      const countryData = Country.getCountryByCode(country.cca2);
      const englishName = country.name.common;
      const frenchName = country.translations.fra?.common ||
        frenchDisplayNames.of(country.cca2) ||
        englishName;

      return {
        code: country.cca2,
        name: frenchName,
        internationalName: countryData?.name || englishName,
        callingCode: callingCodeFor(country.cca2),
        flag: country.flag || countryData?.flag || '',
        continent: continentNames[country.region] || country.region || 'Autres régions',
        subregion: subregionNames[country.subregion] || country.subregion || '',
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
}

export function getGeographicSubdivisions(countryCode: string): GeographySubdivision[] {
  if (!isGeographicCountry(countryCode)) return [];

  return State.getStatesOfCountry(countryCode)
    .map((state) => ({
      code: state.isoCode || stableSlug(state.name),
      name: state.name.replace(
        /\s+(?:Department|Region|State|Province|Prefecture|District|Governorate|Division)$/i,
        ''
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
}

function toGeographyCity(
  countryCode: string,
  regionCode: string | null,
  name: string
): GeographyCity {
  return {
    id: `${countryCode}-${regionCode || 'all'}-${stableSlug(name)}`,
    name,
    regionCode,
  };
}

export function getGeographicCities(
  countryCode: string,
  regionCode?: string | null
): GeographyCity[] {
  if (!isGeographicCountry(countryCode)) return [];

  const subdivisions = State.getStatesOfCountry(countryCode);
  let cities = City.getCitiesOfCountry(countryCode) || [];
  let selectedRegion: string | null = null;

  if (regionCode) {
    const subdivision = subdivisions.find((state) =>
      (state.isoCode || stableSlug(state.name)) === regionCode
    );
    if (!subdivision) return [];
    selectedRegion = subdivision.isoCode || stableSlug(subdivision.name);
    const subdivisionCities = City.getCitiesOfState(countryCode, subdivision.isoCode);
    cities = subdivisionCities.length > 0
      ? subdivisionCities
      : cities.filter((city) => city.stateCode === subdivision.isoCode);
  }

  const seen = new Set<string>();
  return cities
    .filter((city) => city.name.trim().length > 0)
    .filter((city) => {
      const normalized = normalizeCity(city.name);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((city) => toGeographyCity(
      countryCode,
      selectedRegion || city.stateCode || null,
      city.name.trim()
    ))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
}

export function getSubdivisionCodesForCities(
  countryCode: string,
  cityNames: string[]
): Map<string, string | null> {
  const requestedNames = new Set(cityNames.map(normalizeCity));
  const matchingCodes = new Map<string, Set<string>>();

  if (!isGeographicCountry(countryCode) || requestedNames.size === 0) return new Map();

  for (const city of City.getCitiesOfCountry(countryCode) || []) {
    const normalizedName = normalizeCity(city.name);
    if (!requestedNames.has(normalizedName) || !city.stateCode) continue;
    const codes = matchingCodes.get(normalizedName) || new Set<string>();
    codes.add(city.stateCode);
    matchingCodes.set(normalizedName, codes);
  }

  return new Map(Array.from(requestedNames, (name) => {
    const codes = matchingCodes.get(name);
    return [name, codes?.size === 1 ? Array.from(codes)[0] : null];
  }));
}
