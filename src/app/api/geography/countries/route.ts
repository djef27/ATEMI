import { NextResponse } from 'next/server';
import { getGeographicCountries } from '@/lib/geography-data';

export async function GET() {
  const data = getGeographicCountries();
  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  );
}
