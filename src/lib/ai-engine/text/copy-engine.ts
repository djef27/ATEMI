/**
 * ATEMI AI CONTENT ENGINE — Copy Engine
 *
 * Generates marketing copy: hooks, scripts, captions, hashtags.
 * ALL content is based on Product Truth (no inventions).
 */

import { getAIRouter } from '../router/ai-router';
import { recordUsage } from '../cost/cost-tracker';
import type { ProductTruth } from './product-truth';

// ============================================
// Types
// ============================================

export interface GeneratedCopy {
  hook: string;
  title: string;
  description: string;
  caption: string;
  cta: string;
  hashtags: string[];
  voiceoverScript: string;
  textOverlays: string[];
  platform: string;
}

export interface ScriptSegment {
  type: 'hook' | 'product' | 'benefit' | 'cta' | 'transition';
  text: string;
  durationSeconds: number;
}

// ============================================
// Copy Generation
// ============================================

/**
 * Generate copy for a specific platform
 */
export async function generateCopy(
  truth: ProductTruth,
  platform: 'tiktok' | 'instagram' | 'facebook' | 'youtube',
  conceptType: string
): Promise<GeneratedCopy> {
  const router = getAIRouter();

  const platformInstructions: Record<string, string> = {
    tiktok: 'TikTok: hook très rapide (1-3 sec), langage naturel, texte court, énergie haute.',
    instagram: 'Instagram: caption travaillée, CTA clair, hashtags pertinents, ton élégant.',
    facebook: 'Facebook: texte légèrement plus explicatif, ton amical, engagement.',
    youtube: 'YouTube: titre accrocheur, description complète, hashtags.',
  };

  const systemPrompt = `Tu es un copywriter expert pour la marque Atémi, fashion e-commerce au Bénin.
Tu écris du contenu marketing en français pour ${platform}.

RÈGLES ABSOLUES:
- UTILISER UNIQUEMENT les informations vérifiées du produit (Product Truth)
- NE JAMAIS inventer de caractéristiques
- NE JAMAIS utiliser de claims interdits
- Le prix est en FCFA
- Le public cible: ${truth.targetAudience}
- Les hashtags doivent inclure #atemi et des hashtags de catégorie
- Format: JSON strict

${platformInstructions[platform]}`;

  const factualInfo = `PRODUIT VÉRIFIÉ:
Nom: ${truth.name}
Catégorie: ${truth.category}
Prix: ${truth.price} FCFA
Couleurs: ${truth.colors.join(', ')}
Matériaux: ${truth.material.join(', ')}
Style: ${truth.style}
Caractéristiques: ${truth.verifiedFeatures.join(', ')}
Claims autorisés: ${truth.allowedClaims.join(', ')}
Claims INTERDITS: ${truth.forbiddenClaims.join(', ')}

CONCEPT: ${conceptType}`;

  const result = await router.generateText(
    {
      prompt: `${factualInfo}\n\nGénère du contenu marketing pour ce produit sur ${platform}.`,
      systemPrompt,
      maxTokens: 800,
      temperature: 0.7,
    },
    'standard'
  );

  if (!result.success || !result.data) {
    throw new Error(`Copy generation failed: ${result.error}`);
  }

  await recordUsage({
    provider: result.provider,
    operationType: 'copy_generation',
    units: result.data.tokensUsed.total,
    cost: result.cost,
    metadata: { platform, conceptType },
  });

  try {
    const text = result.data.text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }
    return JSON.parse(jsonMatch[1]) as GeneratedCopy;
  } catch {
    // Fallback copy
    return {
      hook: `Découvrez ${truth.name} chez Atémi`,
      title: truth.name,
      description: truth.verifiedFeatures.join(' • '),
      caption: `${truth.name} disponible chez Atémi pour ${truth.price} FCFA`,
      cta: 'Commandez maintenant',
      hashtags: ['#atemi', `#${truth.category.toLowerCase()}`],
      voiceoverScript: `${truth.name} chez Atémi. ${truth.verifiedFeatures[0] || ''}. À partir de ${truth.price} FCFA.`,
      textOverlays: [truth.name, `${truth.price} FCFA`],
      platform,
    };
  }
}

/**
 * Generate voiceover script with timing
 */
export async function generateVoiceoverScript(
  truth: ProductTruth,
  durationSeconds: number,
  conceptType: string
): Promise<ScriptSegment[]> {
  const router = getAIRouter();

  const systemPrompt = `Tu es un scriptwriter pour vidéos courtes (Reels/TikTok).
Durée totale: ${durationSeconds} secondes.
Crée un script voix-off en segments avec timing.

Format JSON strict:
[
  {"type": "hook", "text": "texte", "durationSeconds": 3},
  {"type": "product", "text": "texte", "durationSeconds": 5},
  {"type": "benefit", "text": "texte", "durationSeconds": 4},
  {"type": "cta", "text": "texte", "durationSeconds": 3}
]

RÈGLES:
- Hook: 2-3 secondes, accrocheur
- Product: description courte du produit
- Benefit: bénéfice principal
- CTA: appel à l'action
- Total = ${durationSeconds} secondes
- UNIQUEMENT des faits vérifiés du produit`;

  const result = await router.generateText(
    {
      prompt: `Script pour: ${truth.name} (${truth.price} FCFA, ${truth.category})
Caractéristiques: ${truth.verifiedFeatures.join(', ')}
Concept: ${conceptType}`,
      systemPrompt,
      maxTokens: 600,
      temperature: 0.6,
    },
    'cheap'
  );

  if (!result.success || !result.data) {
    // Fallback script
    return [
      { type: 'hook', text: `Ce ${truth.name} va tout changer`, durationSeconds: 3 },
      { type: 'product', text: `${truth.name} chez Atémi`, durationSeconds: 4 },
      { type: 'benefit', text: truth.verifiedFeatures[0] || 'Style unique', durationSeconds: 4 },
      { type: 'cta', text: `À partir de ${truth.price} FCFA. Commandez!`, durationSeconds: 3 },
    ];
  }

  try {
    const text = result.data.text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\[[\s\S]*\])/);
    if (!jsonMatch) throw new Error('No JSON');
    return JSON.parse(jsonMatch[1]) as ScriptSegment[];
  } catch {
    return [
      { type: 'hook', text: `Ce ${truth.name} va tout changer`, durationSeconds: 3 },
      { type: 'product', text: `${truth.name} chez Atémi`, durationSeconds: 4 },
      { type: 'benefit', text: truth.verifiedFeatures[0] || 'Style unique', durationSeconds: 4 },
      { type: 'cta', text: `À partir de ${truth.price} FCFA. Commandez!`, durationSeconds: 3 },
    ];
  }
}

/**
 * Generate hashtags for a product
 */
export function generateHashtags(truth: ProductTruth, platform: string): string[] {
  const base = ['#atemi'];

  const categoryMap: Record<string, string[]> = {
    'Mode': ['#mode', '#fashion', '#style', '#bénin', '#cotonou'],
    'Perruques': ['#perruque', '#wig', '#hair', '#beauté'],
    'Accessoires': ['#accessoire', '#bijoux', '#style'],
    'Chaussures': ['#chaussures', '#shoes', '#mode'],
    'Beauté': ['#beaute', '#beauty', '#skincare'],
    'Sacs': ['#sac', '#bag', '#sacamain', '#fashion'],
    'Bijoux': ['#bijoux', '#jewelry', '#accessoire'],
  };

  const catTags = categoryMap[truth.category] || [];
  base.push(...catTags);

  if (platform === 'tiktok') {
    base.push('#fyp', '#viral', '#tiktokbenin');
  } else if (platform === 'instagram') {
    base.push('#instafashion', '#ootd', '#reels');
  }

  return base.slice(0, 10);
}
