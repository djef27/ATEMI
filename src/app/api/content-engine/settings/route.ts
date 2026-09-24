/**
 * API: Settings
 * GET /api/content-engine/settings - Get settings
 * PUT /api/content-engine/settings - Update settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { loadBrandConfig, saveBrandConfig } from '@/lib/ai-engine/config/brand-config';
import { getCostSummary, updateLimits } from '@/lib/ai-engine/cost/cost-tracker';
import { getAIRouter } from '@/lib/ai-engine/router/ai-router';

export const GET = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const brand = await loadBrandConfig();
    const costSummary = await getCostSummary();
    const router = getAIRouter();
    const providerStatus = router.getProviderStatus();

    return NextResponse.json({
      success: true,
      data: {
        brand,
        cost: costSummary,
        providers: providerStatus,
      },
    });
  } catch (error) {
    console.error('[CONTENT_ENGINE_SETTINGS_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture des paramètres' },
      { status: 500 }
    );
  }
});

export const PUT = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { brand, limits } = body;

    if (brand) {
      await saveBrandConfig(brand);
    }

    if (limits) {
      await updateLimits(limits);
    }

    return NextResponse.json({
      success: true,
      message: 'Paramètres mis à jour',
    });
  } catch (error) {
    console.error('[CONTENT_ENGINE_SETTINGS_UPDATE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour des paramètres' },
      { status: 500 }
    );
  }
});
