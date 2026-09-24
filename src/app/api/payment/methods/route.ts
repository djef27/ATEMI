import { NextRequest, NextResponse } from 'next/server';
import { getPaymentMethods } from '@/lib/payment/countries';

export function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get('country');
  if (!country) {
    return NextResponse.json(
      { success: false, error: 'Le pays est requis' },
      { status: 400 }
    );
  }

  const data = getPaymentMethods(country);
  if (!data) {
    return NextResponse.json(
      { success: false, error: 'Pays non supporté' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data });
}
