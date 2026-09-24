/**
 * ATEMI AI CONTENT ENGINE — Product Analyzer
 *
 * Analyzes a product from the existing catalog and generates
 * a structured marketing analysis using AI.
 */

import { getAIRouter } from '../router/ai-router';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { recordUsage } from '../cost/cost-tracker';

// ============================================
// Types
// ============================================

export interface ProductAnalysis {
  productName: string;
  category: string;
  visualDescription: string;
  colors: string[];
  materials: string[];
  visibleFeatures: string[];
  targetAudience: string;
  style: string;
  marketingAngles: string[];
  allowedClaims: string[];
  forbiddenClaims: string[];
  priceRange: string;
  competitiveAdvantage: string;
  socialMediaHooks: string[];
}

export interface ProductInput {
  productId: string;
  name: string;
  description: string | null;
  sellingPrice: number;
  supplierPrice: number;
  category: string;
  images: string[];
  vendorName: string;
  stock: number;
}

// ============================================
// Analyzer
// ============================================

/**
 * Analyze a product using AI
 */
export async function analyzeProduct(input: ProductInput): Promise<ProductAnalysis> {
  const router = getAIRouter();

  const systemPrompt = `Tu es un expert en marketing e-commerce pour la marque Atémi, basée au Bénin.
Tu analyses des produits de mode et accessoires pour créer du contenu marketing professionnel.

RÈGLES STRICTES:
- NE JAMAIS inventer de caractéristiques non mentionnées dans les données produit
- Si une information n'est pas connue, utiliser "UNKNOWN"
- Le prix est en FCFA (franc CFA)
- Le public cible est principalement en Afrique de l'Ouest
- Les claims autorisés doivent être vérifiables
- Les claims interdits incluent: guérison, miracle, scientifically proven, etc.

Réponds en JSON strict avec cette structure:
{
  "productName": "string",
  "category": "string",
  "visualDescription": "description détaillée du produit visible sur les images",
  "colors": ["couleur1", "couleur2"],
  "materials": ["matériau1"] ou ["UNKNOWN"],
  "visibleFeatures": ["caractéristique visible 1"],
  "targetAudience": "description du public cible",
  "style": "style du produit (casual, élégant, sportif, etc.)",
  "marketingAngles": ["angle 1", "angle 2", "angle 3"],
  "allowedClaims": ["claim autorisé 1"],
  "forbiddenClaims": ["claim interdit 1"],
  "priceRange": "accessible/mid-range/premium selon le prix",
  "competitiveAdvantage": "avantage compétitif principal",
  "socialMediaHooks": ["hook 1 pour TikTok/Reels", "hook 2"]
}`;

  const prompt = `Analyse ce produit pour créer du contenu marketing:

NOM: ${input.name}
CATÉGORIE: ${input.category}
PRIX: ${input.sellingPrice} FCFA
FOURNISSEUR: ${input.vendorName}
STOCK: ${input.stock} unités
DESCRIPTION: ${input.description || "Non fournie"}
IMAGES: ${input.images.length} image(s) disponible(s)

Analyse le produit et fournis une analyse marketing complète en JSON.`;

  const result = await router.generateText(
    {
      prompt,
      systemPrompt,
      maxTokens: 1500,
      temperature: 0.3,
    },
    'standard'
  );

  if (!result.success || !result.data) {
    throw new Error(`Product analysis failed: ${result.error}`);
  }

  // Record usage
  await recordUsage({
    provider: result.provider,
    operationType: 'product_analysis',
    units: result.data.tokensUsed.total,
    cost: result.cost,
    metadata: { productId: input.productId },
  });

  // Parse JSON response
  try {
    const text = result.data.text.trim();
    // Extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const analysis = JSON.parse(jsonMatch[1]) as ProductAnalysis;
    return analysis;
  } catch {
    // If parsing fails, return a basic analysis
    return {
      productName: input.name,
      category: input.category,
      visualDescription: input.description || 'UNKNOWN',
      colors: ['UNKNOWN'],
      materials: ['UNKNOWN'],
      visibleFeatures: [],
      targetAudience: 'Femmes 18-45 ans, Afrique de l\'Ouest',
      style: 'UNKNOWN',
      marketingAngles: ['Qualité', 'Style', 'Prix accessible'],
      allowedClaims: ['Produit de qualité', 'Livraison disponible'],
      forbiddenClaims: ['Guérison', 'Miracle', 'Scientifiquement prouvé'],
      priceRange: input.sellingPrice < 10000 ? 'accessible' : input.sellingPrice < 50000 ? 'mid-range' : 'premium',
      competitiveAdvantage: 'UNKNOWN',
      socialMediaHooks: [`Découvrez ce magnifique ${input.name}`, `${input.name} - Style Atémi`],
    };
  }
}

/**
 * Fetch product data from database
 */
export async function fetchProductForAnalysis(productId: string): Promise<ProductInput | null> {
  const supabase = createAdminSupabaseClient();

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      id, name, description, selling_price, supplier_price, stock, status,
      category_id, vendor_id,
      categories(name),
      vendors(name)
    `)
    .eq('id', productId)
    .single();

  if (error || !product) {
    return null;
  }

  // Fetch images
  const { data: images } = await supabase
    .from('product_images')
    .select('image_url')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  const category = Array.isArray(product.categories) ? (product.categories[0] as { name: string })?.name || 'Autres' : 'Autres';
  const vendorName = Array.isArray(product.vendors) ? (product.vendors[0] as { name: string })?.name || '' : '';

  return {
    productId: product.id,
    name: product.name,
    description: product.description,
    sellingPrice: product.selling_price,
    supplierPrice: product.supplier_price,
    category,
    images: (images || []).map((img) => img.image_url),
    vendorName,
    stock: product.stock,
  };
}
