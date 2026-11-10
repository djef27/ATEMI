/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getCountries } from '../countries/route';
import { GET as getRegions } from '../regions/route';
import { GET as getCities } from '../cities/route';

describe('public geography reference routes', () => {
  it('returns grouped-catalog metadata for the ten checkout target countries', async () => {
    const response = await getCountries();
    const result = await response.json();
    const countries = result.data as Array<{
      code: string;
      name: string;
      internationalName: string;
      callingCode: string;
      continent: string;
    }>;

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate');
    expect(new Set(countries.map((country) => country.code)).size).toBe(countries.length);

    for (const [code, callingCode] of [
      ['BJ', '229'], ['CI', '225'], ['TG', '228'], ['GH', '233'], ['NG', '234'],
      ['SN', '221'], ['CM', '237'], ['FR', '33'], ['ES', '34'], ['SG', '65'],
    ]) {
      expect(countries.find((country) => country.code === code)?.callingCode).toBe(callingCode);
    }

    expect(countries.find((country) => country.code === 'FR')?.name).toBe('France');
    expect(countries.find((country) => country.code === 'ES')?.name).toBe('Espagne');
  });

  it.each([
    ['BJ', 'LI', 'Cotonou'],
    ['CI', 'AB', 'Abidjan'],
    ['TG', 'M', 'Lomé'],
    ['GH', 'AA', 'Accra'],
    ['NG', 'LA', 'Lagos'],
    ['SN', 'DK', 'Dakar'],
    ['CM', 'LT', 'Douala'],
    ['FR', 'IDF', 'Paris'],
    ['ES', 'MD', 'Madrid'],
    ['SG', '01', 'Singapore'],
  ])('returns %s regions and scoped cities from source data', async (country, region, expectedCity) => {
    const regionsResponse = await getRegions(
      new NextRequest(`http://localhost/api/geography/regions?country=${country}`)
    );
    const regionsResult = await regionsResponse.json();
    expect(regionsResult.data.some((item: { code: string }) => item.code === region)).toBe(true);

    const citiesResponse = await getCities(
      new NextRequest(`http://localhost/api/geography/cities?country=${country}&region=${region}`)
    );
    const citiesResult = await citiesResponse.json();
    expect(citiesResponse.status).toBe(200);
    expect(citiesResult.data.some((item: { name: string }) => item.name === expectedCity)).toBe(true);
    expect(citiesResult.data.every((item: { id: string }) => item.id.startsWith(`${country}-${region}-`))).toBe(true);
  });

  it('rejects unknown countries and subdivisions belonging to another country', async () => {
    const unknownCountryResponse = await getRegions(
      new NextRequest('http://localhost/api/geography/regions?country=ZZ')
    );
    expect(unknownCountryResponse.status).toBe(400);

    const mismatchedRegionResponse = await getCities(
      new NextRequest('http://localhost/api/geography/cities?country=TG&region=LI')
    );
    expect(mismatchedRegionResponse.status).toBe(400);
    expect(await mismatchedRegionResponse.json()).toMatchObject({
      success: false,
      error: 'La région ne correspond pas au pays sélectionné.',
    });
  });

  it('returns an empty result for a country without reference subdivisions or cities', async () => {
    const regionsResponse = await getRegions(
      new NextRequest('http://localhost/api/geography/regions?country=GF')
    );
    const citiesResponse = await getCities(
      new NextRequest('http://localhost/api/geography/cities?country=GF')
    );

    expect((await regionsResponse.json()).data).toEqual([]);
    expect((await citiesResponse.json()).data).toEqual([]);
  });
});
