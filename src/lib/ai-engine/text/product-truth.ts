/**
 * ATEMI AI CONTENT ENGINE — Product Truth Layer
 *
 * Maintains a single source of truth for each product.
 * All content generation MUST reference this truth.
 * AI is NEVER allowed to invent product facts.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import type { ProductAnalysis } from './product-analyzer';
import { getAppUrl } from '@/lib/app-url';

// ============================================
// Types
// ============================================

export interface ProductTruth {
  productId: string;
  name: string;
  description: string;
  price: number;
  supplierPrice: number;
  category: string;
  vendorName: string;
  material: string[];
  colors: string[];
  dimensions: string | null;
  verifiedFeatures: string[];
  productUrl: string;
  sourceImages: string[];
  allowedClaims: string[];
  forbiddenClaims: string[];
  style: string;
  targetAudience: string;
  priceRange: string;
  competitiveAdvantage: string;
  lastVerifiedAt: string;
}

// ============================================
// Truth Layer Functions
// ============================================

/**
 * Create or update product truth from analysis
 */
export async function createProductTruth(
  projectId: string,
  productId: string,
  analysis: ProductAnalysis,
  images: string[]
): Promise<ProductTruth> {
  const truth: ProductTruth = {
    productId,
    name: analysis.productName,
    description: '', // Will be filled from product data
    price: 0, // Will be filled from product data
    supplierPrice: 0,
    category: analysis.category,
    vendorName: '',
    material: analysis.materials,
    colors: analysis.colors,
    dimensions: null,
    verifiedFeatures: analysis.visibleFeatures,
    productUrl: `${getAppUrl()}/products/${productId}`,
    sourceImages: images,
    allowedClaims: analysis.allowedClaims,
    forbiddenClaims: analysis.forbiddenClaims,
    style: analysis.style,
    targetAudience: analysis.targetAudience,
    priceRange: analysis.priceRange,
    competitiveAdvantage: analysis.competitiveAdvantage,
    lastVerifiedAt: new Date().toISOString(),
  };

  // Store in Supabase
  const supabase = createAdminSupabaseClient();
  await supabase
    .from('content_projects')
    .upsert({
      product_id: productId,
      product_truth: truth as unknown as Record<string, unknown>,
      analysis: analysis as unknown as Record<string, unknown>,
      status: 'analyzed',
    }, { onConflict: 'product_id' });

  return truth;
}

/**
 * Get product truth
 */
export async function getProductTruth(productId: string): Promise<ProductTruth | null> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('content_projects')
    .select('product_truth')
    .eq('product_id', productId)
    .single();

  if (!data?.product_truth) return null;
  return data.product_truth as unknown as ProductTruth;
}

/**
 * Validate that a claim is allowed for this product
 */
export function validateClaim(truth: ProductTruth, claim: string): boolean {
  // Check forbidden claims
  const lowerClaim = claim.toLowerCase();
  for (const forbidden of truth.forbiddenClaims) {
    if (lowerClaim.includes(forbidden.toLowerCase())) {
      return false;
    }
  }

  // Check if claim is about unknown features
  if (lowerClaim.includes('unknown')) {
    return false;
  }

  return true;
}

/**
 * Generate a factual description based ONLY on verified truth
 */
export function generateFactualDescription(truth: ProductTruth): string {
  const parts: string[] = [];

  parts.push(`${truth.name}`);

  if (truth.colors.length > 0 && truth.colors[0] !== 'UNKNOWN') {
    parts.push(`disponible en ${truth.colors.join(', ')}`);
  }

  if (truth.material.length > 0 && truth.material[0] !== 'UNKNOWN') {
    parts.push(`en ${truth.material.join(' et ')}`);
  }

  if (truth.verifiedFeatures.length > 0) {
    parts.push(`caractéristiques: ${truth.verifiedFeatures.join(', ')}`);
  }

  if (truth.priceRange !== 'UNKNOWN') {
    parts.push(`gamme ${truth.priceRange}`);
  }

  return parts.join(' — ');
}

/**
 * Get safe hashtags based on truth (no invented claims)
 */
export function getSafeHashtags(truth: ProductTruth): string[] {
  const hashtags: string[] = ['#atemi'];

  // Category hashtags
  const categoryMap: Record<string, string[]> = {
    'Mode': ['#mode', '#fashion', '#style'],
    'Perruques': ['#perruque', '#wig', '#hair'],
    'Accessoires': ['#accessoire', '#bijoux'],
    'Chaussures': ['#chaussures', '#shoes'],
    'Beauté': ['#beaute', '#beauty'],
    'Sacs': ['#sac', '#bag', '#sacamain'],
    'Bijoux': ['#bijoux', '#jewelry'],
  };

  const categoryTags = categoryMap[truth.category] || [];
  hashtags.push(...categoryTags);

  // Style hashtags
  if (truth.style && truth.style !== 'UNKNOWN') {
    hashtags.push(`#${truth.style.toLowerCase()}`);
  }

  return hashtags.slice(0, 10);
}
