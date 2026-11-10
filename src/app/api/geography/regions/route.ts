import { NextRequest, NextResponse } from 'next/server';
import { getGeographicSubdivisions, isGeographicCountry } from '@/lib/geography-data';

export async function GET(request: NextRequest) {
  const country = (request.nextUrl.searchParams.get('country') || '').toUpperCase();
  if (!isGeographicCountry(country)) {
    return NextResponse.json(
      { success: false, error: 'Le code pays est invalide ou non disponible.' },
      { status: 400 }
    );
  }

  const data = getGeographicSubdivisions(country);
  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  );
}
