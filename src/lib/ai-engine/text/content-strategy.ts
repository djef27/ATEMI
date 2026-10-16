/**
 * ATEMI AI CONTENT ENGINE — Content Strategy Engine
 *
 * Generates multiple content concepts for a product.
 * Each concept has a unique angle, hook, and visual direction.
 */

import { getAIRouter } from '../router/ai-router';
import { recordUsage } from '../cost/cost-tracker';
import type { ProductTruth } from './product-truth';

// ============================================
// Types
// ============================================

export type ConceptType =
  | 'ugc'
  | 'product_showcase'
  | 'lifestyle'
  | 'problem_solution'
  | 'before_after'
  | 'three_ways'
  | 'product_details'
  | 'storytelling'
  | 'promotional'
  | 'premium_commercial';

export interface ContentConcept {
  conceptType: ConceptType;
  hook: string;
  angle: string;
  script: string;
  visualDirection: string;
  voiceDirection: string;
  cta: string;
  caption: string;
  hashtags: string[];
  durationSeconds: number;
  platform: string;
  priority: number;
}

export interface ContentPlan {
  projectId: string;
  concepts: ContentConcept[];
  generatedAt: string;
}

// ============================================
// Concept Definitions
// ============================================

const CONCEPT_DEFINITIONS: Record<ConceptType, { name: string; description: string }> = {
  ugc: { name: 'UGC', description: 'User Generated Content - aspect naturel, comme un client qui partage' },
  product_showcase: { name: 'Product Showcase', description: 'Mise en valeur du produit avec angles multiples' },
  lifestyle: { name: 'Lifestyle', description: 'Le produit dans un contexte de vie réel' },
  problem_solution: { name: 'Problem → Solution', description: 'Le produit résout un problème' },
  before_after: { name: 'Before/After', description: 'Transformation avec le produit' },
  three_ways: { name: '3 Ways to Use', description: 'Trois utilisations différentes du produit' },
  product_details: { name: 'Product Details', description: 'Focus sur les détails et finitions' },
  storytelling: { name: 'Storytelling', description: 'Histoire emotionnelle autour du produit' },
  promotional: { name: 'Promotional', description: 'Offre spéciale, urgence' },
  premium_commercial: { name: 'Premium Commercial', description: 'Format publicitaire premium' },
};

// ============================================
// Strategy Generation
// ============================================

/**
 * Generate a complete content plan for a product
 */
export async function generateContentPlan(
  truth: ProductTruth,
  projectId: string,
  platforms: string[] = ['tiktok', 'instagram', 'facebook']
): Promise<ContentPlan> {
  const router = getAIRouter();

  const systemPrompt = `Tu es directeur de contenu créatif pour Atémi, une marketplace africaine dont le lancement s'effectue au Bénin.
Tu crées des concepts de contenu pour produits e-commerce.

Pour CHAQUE concept, fournis:
- conceptType: type de concept
- hook: accroche (2-3 mots pour TikTok, plus long pour Instagram)
- angle: angle marketing unique
- script: script voix-off court (5-10 secondes)
- visualDirection: direction visuelle pour l'IA d'image
- voiceDirection: ton de la voix (ex: "féminin, chaleureux, enthousiaste")
- cta: appel à l'action
- caption: légende complète
- hashtags: 5-8 hashtags pertinents
- durationSeconds: durée (10, 15, 20 ou 30 sec)
- platform: plateforme cible

IMPORTANT: Chaque concept doit être UNIQUE. Pas de doublons.
Angle différent = hook différent = script différent = montage différent.

PRODUIT:
Nom: ${truth.name}
Catégorie: ${truth.category}
Prix: ${truth.price} FCFA
Style: ${truth.style}
Caractéristiques: ${truth.verifiedFeatures.join(', ')}
Couleurs: ${truth.colors.join(', ')}
Public cible: ${truth.targetAudience}
Avantage compétitif: ${truth.competitiveAdvantage}`;

  const result = await router.generateText(
    {
      prompt: `Crée un plan de contenu avec 6 concepts uniques pour ce produit sur les plateformes: ${platforms.join(', ')}.

Concepts requis:
1. UGC (TikTok)
2. Product Showcase (Instagram)
3. Lifestyle (TikTok + Instagram)
4. Problem/Solution (Facebook)
5. Storytelling (Instagram)
6. Premium Commercial (Toutes plateformes)

Chaque concept doit avoir un angle, hook et script DIFFÉRENT.`,
      systemPrompt,
      maxTokens: 3000,
      temperature: 0.8,
    },
    'standard'
  );

  if (!result.success || !result.data) {
    throw new Error(`Content plan generation failed: ${result.error}`);
  }

  await recordUsage({
    provider: result.provider,
    operationType: 'content_plan_generation',
    units: result.data.tokensUsed.total,
    cost: result.cost,
    metadata: { projectId, conceptCount: 6 },
  });

  try {
    const text = result.data.text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\[[\s\S]*\])/);
    if (!jsonMatch) throw new Error('No JSON');
    const concepts = JSON.parse(jsonMatch[1]) as ContentConcept[];
    return {
      projectId,
      concepts,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    // Fallback concepts
    return generateFallbackPlan(truth, projectId);
  }
}

/**
 * Fallback content plan when AI fails
 */
function generateFallbackPlan(truth: ProductTruth, projectId: string): ContentPlan {
  return {
    projectId,
    concepts: [
      {
        conceptType: 'ugc',
        hook: `J'ai trouvé le truc parfait`,
        angle: 'Découverte personnelle, ton naturel',
        script: `Regardez ce ${truth.name} que je viens de trouver chez Atémi. ${truth.verifiedFeatures[0] || 'Il est vraiment beau'}. Et le prix? ${truth.price} FCFA seulement.`,
        visualDirection: 'Camera selfie, éclairage naturel, fond simple',
        voiceDirection: 'Féminin, enthousiaste, naturel',
        cta: 'Lien en bio pour commander',
        caption: `${truth.name} chez Atémi - ${truth.price} FCFA`,
        hashtags: ['#atemi', '#decouverte', '#mode', '#modeafricaine', '#fashion'],
        durationSeconds: 15,
        platform: 'tiktok',
        priority: 1,
      },
      {
        conceptType: 'product_showcase',
        hook: `${truth.name} Atémi`,
        angle: 'Présentation premium du produit',
        script: `${truth.name}. Disponible en ${truth.colors.join(' et ')}. ${truth.verifiedFeatures[0] || ''}. À partir de ${truth.price} FCFA chez Atémi.`,
        visualDirection: 'Fond épuré, éclairage studio, rotation produit',
        voiceDirection: 'Féminin, élégant, professionnel',
        cta: 'Commandez sur ate.bj',
        caption: `${truth.name} - Collection Atémi`,
        hashtags: ['#atemi', '#collection', '#mode', '#elegance', '#createursafricains'],
        durationSeconds: 15,
        platform: 'instagram',
        priority: 2,
      },
      {
        conceptType: 'lifestyle',
        hook: `Le ${truth.style.toLowerCase()} au quotidien`,
        angle: 'Intégration du produit dans la vie quotidienne',
        script: `Chaque jour avec ${truth.name} chez Atémi. ${truth.verifiedFeatures[0] || 'Parfait pour toutes les occasions'}. ${truth.price} FCFA.`,
        visualDirection: 'Scène de vie quotidienne, lumière dorée',
        voiceDirection: 'Féminin, chaleureux, inspirant',
        cta: 'Découvrez la collection',
        caption: `Le style au quotidien avec Atémi`,
        hashtags: ['#atemi', '#quotidien', '#style', '#lifestyle', '#modeafricaine'],
        durationSeconds: 20,
        platform: 'tiktok',
        priority: 3,
      },
      {
        conceptType: 'problem_solution',
        hook: `Vous cherchez le ${truth.category.toLowerCase()} parfait?`,
        angle: 'Résolution d\'un problème client',
        script: `Vous ne trouvez jamais le bon ${truth.category.toLowerCase()}? Découvrez ${truth.name} chez Atémi. ${truth.verifiedFeatures[0] || 'Un produit à découvrir'}. ${truth.price} FCFA.`,
        visualDirection: 'Split screen: problème vs solution',
        voiceDirection: 'Féminin, rassurant, confiant',
        cta: 'Solution Atémi',
        caption: `Le ${truth.category.toLowerCase()} que vous attendiez`,
        hashtags: ['#atemi', '#solution', '#mode', '#modeafricaine', '#fashion'],
        durationSeconds: 20,
        platform: 'facebook',
        priority: 4,
      },
      {
        conceptType: 'storytelling',
        hook: `L'histoire derrière ${truth.name}`,
        angle: 'Histoire emotionnelle du produit',
        script: `Chaque produit Atémi raconte une histoire. ${truth.name}, c'est ${truth.verifiedFeatures[0] || 'élégance et qualité'}. Une histoire qui commence à ${truth.price} FCFA.`,
        visualDirection: 'Cinématique, ambiance douce, gros plans',
        voiceDirection: 'Féminin, doux, narratif',
        cta: 'Racontez la vôtre',
        caption: `L'élégance a une histoire. Atémi.`,
        hashtags: ['#atemi', '#storytelling', '#élégance', '#mode', '#createursafricains'],
        durationSeconds: 20,
        platform: 'instagram',
        priority: 5,
      },
      {
        conceptType: 'premium_commercial',
        hook: `Atémi - ${truth.name}`,
        angle: 'Publicité premium classe',
        script: `${truth.name} par Atémi. ${truth.verifiedFeatures.join('. ')}. Découvrez-le à ${truth.price} FCFA. Atémi, les talents d’Afrique.`,
        visualDirection: 'Format publicitaire, transitions fluides, branding',
        voiceDirection: 'Féminin, professionnel, premium',
        cta: 'ate.bj',
        caption: `Atémi — Les talents d’Afrique`,
        hashtags: ['#atemi', '#premium', '#modeafricaine', '#createursafricains', '#beauté'],
        durationSeconds: 30,
        platform: 'all',
        priority: 6,
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get concept type info
 */
export function getConceptInfo(type: ConceptType) {
  return CONCEPT_DEFINITIONS[type];
}
