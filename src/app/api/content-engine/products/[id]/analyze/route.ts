/**
 * API: Analyze a product
 * POST /api/content-engine/products/[id]/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import { analyzeProduct, fetchProductForAnalysis } from '@/lib/ai-engine/text/product-analyzer';
import { createProductTruth } from '@/lib/ai-engine/text/product-truth';
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

    // Fetch product data
    const productInput = await fetchProductForAnalysis(productId);
    if (!productInput) {
      return NextResponse.json(
        { success: false, error: 'Produit non trouvé' },
        { status: 404 }
      );
    }

    // Analyze product
    const analysis = await analyzeProduct(productInput);

    // Create/update product truth
    const supabase = createAdminSupabaseClient();
    const { data: existing } = await supabase
      .from('content_projects')
      .select('id')
      .eq('product_id', productId)
      .single();

    const projectId = existing?.id || productId;

    const truth = await createProductTruth(
      projectId,
      productId,
      analysis,
      productInput.images
    );

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        truth,
        projectId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur lors de l\'analyse' },
      { status: 500 }
    );
  }
});
