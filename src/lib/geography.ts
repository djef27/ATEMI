export interface GeographyCountry {
  code: string;
  name: string;
  internationalName: string;
  callingCode: string;
  flag: string;
  continent: string;
  subregion: string;
}

export interface GeographySubdivision {
  code: string;
  name: string;
}

export interface GeographyCity {
  id: string;
  name: string;
  regionCode: string | null;
}

export interface CountryGroup {
  label: string;
  countries: GeographyCountry[];
}

export function groupCountriesByContinent(countries: GeographyCountry[]): CountryGroup[] {
  const grouped = new Map<string, GeographyCountry[]>();
  for (const country of countries) {
    const key = country.subregion
      ? `${country.continent} — ${country.subregion}`
      : country.continent;
    const group = grouped.get(key) || [];
    group.push(country);
    grouped.set(key, group);
  }

  return Array.from(grouped, ([label, groupedCountries]) => ({
    label,
    countries: groupedCountries,
  }));
}
