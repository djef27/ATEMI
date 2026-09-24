/**
 * API: Generate content concepts for a product
 * POST /api/content-engine/products/[id]/concepts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import { generateContentPlan } from '@/lib/ai-engine/text/content-strategy';
import { getProductTruth } from '@/lib/ai-engine/text/product-truth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export const POST = withContentAdminAuth(async (request: NextRequest) => {
  try {
    // Extract product ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const productId = pathParts[pathParts.indexOf('products') + 1];

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID requis' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const platforms = body.platforms || ['tiktok', 'instagram', 'facebook'];

    // Get product truth
    const truth = await getProductTruth(productId);
    if (!truth) {
      return NextResponse.json(
        { success: false, error: 'Produit non analysé. Lancez l\'analyse d\'abord.' },
        { status: 400 }
      );
    }

    // Get project ID
    const supabase = createAdminSupabaseClient();
    const { data: project } = await supabase
      .from('content_projects')
      .select('id')
      .eq('product_id', productId)
      .single();

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    // Generate content plan
    const contentPlan = await generateContentPlan(truth, project.id, platforms);

    // Save concepts to database
    for (const concept of contentPlan.concepts) {
      await supabase.from('content_concepts').insert({
        project_id: project.id,
        concept_type: concept.conceptType,
        hook: concept.hook,
        angle: concept.angle,
        script: concept.script,
        visual_direction: concept.visualDirection,
        voice_direction: concept.voiceDirection,
        cta: concept.cta,
        caption: concept.caption,
        hashtags: concept.hashtags,
        duration_seconds: concept.durationSeconds,
        platform: concept.platform,
        status: 'draft',
      });
    }

    // Update project status
    await supabase
      .from('content_projects')
      .update({ status: 'ready' })
      .eq('id', project.id);

    return NextResponse.json({
      success: true,
      data: {
        conceptsCount: contentPlan.concepts.length,
        concepts: contentPlan.concepts,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur lors de la génération' },
      { status: 500 }
    );
  }
});
