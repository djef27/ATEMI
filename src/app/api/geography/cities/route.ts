import { NextRequest, NextResponse } from 'next/server';
import { getGeographicCities, getGeographicSubdivisions, isGeographicCountry } from '@/lib/geography-data';

export async function GET(request: NextRequest) {
  const country = (request.nextUrl.searchParams.get('country') || '').toUpperCase();
  const region = request.nextUrl.searchParams.get('region');

  if (!isGeographicCountry(country)) {
    return NextResponse.json(
      { success: false, error: 'Le code pays est invalide ou non disponible.' },
      { status: 400 }
    );
  }

  if (region && !getGeographicSubdivisions(country).some((item) => item.code === region)) {
    return NextResponse.json(
      { success: false, error: 'La région ne correspond pas au pays sélectionné.' },
      { status: 400 }
    );
  }

  const data = getGeographicCities(country, region);
  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  );
}
