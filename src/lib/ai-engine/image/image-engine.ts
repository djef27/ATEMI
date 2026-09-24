/**
 * ATEMI AI CONTENT ENGINE — Image Engine
 *
 * Generates marketing images for products using AI.
 * Validates product visual consistency.
 */

import { getAIRouter } from '../router/ai-router';
import { recordUsage } from '../cost/cost-tracker';
import { uploadAsset } from '../storage/storage-manager';
import type { ProductTruth } from '../text/product-truth';

// ============================================
// Types
// ============================================

export type ImageType = 'studio' | 'lifestyle' | 'marketing' | 'closeup' | 'detail';

export interface ImageGenerationPrompt {
  productId: string;
  truth: ProductTruth;
  imageType: ImageType;
  customPrompt?: string;
}

export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
  path: string;
  imageType: ImageType;
}

// ============================================
// Prompt Templates
// ============================================

const IMAGE_PROMPTS: Record<ImageType, (truth: ProductTruth) => string> = {
  studio: (truth) =>
    `Professional product photography of a ${truth.name}, ${truth.category.toLowerCase()}.
    Colors: ${truth.colors.join(', ')}.
    Material: ${truth.material.join(', ')}.
    Style: ${truth.style}.
    Clean white background, studio lighting, high-end fashion photography.
    Sharp focus, commercial quality. No text, no watermarks.`,

  lifestyle: (truth) =>
    `Lifestyle photography featuring a ${truth.name}, ${truth.category.toLowerCase()}.
    Colors: ${truth.colors.join(', ')}.
    Style: ${truth.style}.
    Natural setting, warm lighting, African woman enjoying the product.
    Candid moment, authentic lifestyle. No text overlays.`,

  marketing: (truth) =>
    `Marketing flat lay photography of a ${truth.name}, ${truth.category.toLowerCase()}.
    Colors: ${truth.colors.join(', ')}.
    Arranged beautifully with complementary props.
    Neutral background, soft shadows, Instagram-worthy aesthetic.
    Premium fashion content. No text.`,

  closeup: (truth) =>
    `Extreme close-up macro photography of a ${truth.name}.
    Focus on material texture and quality details.
    Colors: ${truth.colors.join(', ')}.
    Material: ${truth.material.join(', ')}.
    Shallow depth of field, luxury product photography.`,

  detail: (truth) =>
    `Detail shot of a ${truth.name} showing craftsmanship.
    Focus on stitching, hardware, or unique features.
    Colors: ${truth.colors.join(', ')}.
    Professional product photography, sharp detail.`,
};

// ============================================
// Image Generation
// ============================================

/**
 * Generate a marketing image
 */
export async function generateProductImage(
  params: ImageGenerationPrompt
): Promise<GeneratedImage> {
  const router = getAIRouter();
  const { productId, truth, imageType, customPrompt } = params;

  const promptFn = IMAGE_PROMPTS[imageType];
  const basePrompt = customPrompt || promptFn(truth);

  const result = await router.generateImage(
    {
      prompt: basePrompt,
      size: '1024x1024',
      quality: 'hd',
      style: 'natural',
    },
    'standard'
  );

  if (!result.success || !result.data || result.data.images.length === 0) {
    throw new Error(`Image generation failed: ${result.error}`);
  }

  const imageData = result.data.images[0];

  // Upload to storage
  const uploadResult = await uploadAsset(
    productId,
    'image',
    `${imageType}_${Date.now()}.png`,
    Buffer.from(imageData.base64 || '', 'base64'),
    'image/png'
  );

  await recordUsage({
    provider: result.provider,
    operationType: 'image_generation',
    units: 1,
    cost: result.cost,
    metadata: { productId, imageType },
  });

  return {
    url: imageData.url || uploadResult.url,
    revisedPrompt: imageData.revisedPrompt,
    path: uploadResult.path,
    imageType,
  };
}

/**
 * Generate multiple images for a product
 */
export async function generateProductImages(
  productId: string,
  truth: ProductTruth,
  imageTypes: ImageType[] = ['studio', 'lifestyle', 'marketing']
): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = [];

  for (const imageType of imageTypes) {
    try {
      const image = await generateProductImage({
        productId,
        truth,
        imageType,
      });
      images.push(image);
    } catch (error) {
      console.error(`Failed to generate ${imageType} image:`, error);
      // Continue with other images
    }
  }

  return images;
}

/**
 * Validate that a generated image is consistent with the product
 * (Basic validation - can be enhanced with vision AI)
 */
export function validateImageConsistency(
  generatedPrompt: string,
  truth: ProductTruth
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check that colors mentioned in prompt match product colors
  const lowerPrompt = generatedPrompt.toLowerCase();
  for (const color of truth.colors) {
    if (color !== 'UNKNOWN' && !lowerPrompt.includes(color.toLowerCase())) {
      issues.push(`Color ${color} not mentioned in generated prompt`);
    }
  }

  // Check category match
  if (truth.category !== 'UNKNOWN' && !lowerPrompt.includes(truth.category.toLowerCase())) {
    issues.push(`Category ${truth.category} not in generated prompt`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
