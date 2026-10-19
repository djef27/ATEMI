import { NextRequest, NextResponse } from 'next/server';
import { getPaymentMethods } from '@/lib/payment/countries';
import { withRateLimit } from '@/lib/auth-helpers';
import { RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export const GET = withRateLimit(
  RATE_LIMIT_CONFIGS.general,
  async (request: NextRequest): Promise<NextResponse> => {
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
);
