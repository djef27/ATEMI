/**
 * API: Run content pipeline
 * POST /api/content-engine/generations - Run full pipeline for a product
 * GET /api/content-engine/generations - Get pipeline status
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import { runPipeline, getPipelineStatus } from '@/lib/ai-engine/pipeline/media-pipeline';

export const POST = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId requis' },
        { status: 400 }
      );
    }

    // Run pipeline asynchronously (would use job queue in production)
    const result = await runPipeline(productId);

    return NextResponse.json({
      success: result.status === 'completed',
      data: result,
    });
  } catch (error) {
    console.error('[CONTENT_ENGINE_PIPELINE_POST_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'exécution du pipeline' },
      { status: 500 }
    );
  }
});

export const GET = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId requis' },
        { status: 400 }
      );
    }

    const status = await getPipelineStatus(productId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[CONTENT_ENGINE_PIPELINE_GET_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture du statut pipeline' },
      { status: 500 }
    );
  }
});
