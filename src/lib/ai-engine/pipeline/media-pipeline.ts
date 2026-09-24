/**
 * ATEMI AI CONTENT ENGINE — Media Pipeline
 *
 * Orchestrates the entire content generation process:
 * Product → Analysis → Concepts → Copy → Images → Voice → Video → QA → Queue
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { analyzeProduct, fetchProductForAnalysis } from '../text/product-analyzer';
import { createProductTruth, getProductTruth } from '../text/product-truth';
import { generateContentPlan } from '../text/content-strategy';
import { generateCopy } from '../text/copy-engine';
import { generateProductImages } from '../image/image-engine';
import { generateVoiceover } from '../voice/voice-engine';
import { generateMusic } from '../music/music-engine';
import { generateVideoSubtitles } from '../video/video-engine';
import { runVideoQA, runCopyQA, saveQAResult } from './qa-engine';
import { addToQueue } from '../queue/content-queue';
import { canGenerate, recordUsage } from '../cost/cost-tracker';

// ============================================
// Types
// ============================================

export type PipelineStatus = 'idle' | 'analyzing' | 'generating' | 'assembling' | 'qa' | 'queuing' | 'completed' | 'failed';

export interface PipelineResult {
  projectId: string;
  status: PipelineStatus;
  conceptsGenerated: number;
  imagesGenerated: number;
  videosGenerated: number;
  itemsQueued: number;
  errors: string[];
}

// ============================================
// Main Pipeline
// ============================================

/**
 * Run the full content generation pipeline for a product
 */
export async function runPipeline(productId: string): Promise<PipelineResult> {
  const result: PipelineResult = {
    projectId: '',
    status: 'idle',
    conceptsGenerated: 0,
    imagesGenerated: 0,
    videosGenerated: 0,
    itemsQueued: 0,
    errors: [],
  };

  try {
    // 1. Check budget
    const budgetCheck = await canGenerate(0.50);
    if (!budgetCheck.allowed) {
      throw new Error(budgetCheck.reason);
    }

    // 2. Fetch product data
    result.status = 'analyzing';
    const productInput = await fetchProductForAnalysis(productId);
    if (!productInput) {
      throw new Error(`Product ${productId} not found`);
    }

    // 3. Analyze product
    const analysis = await analyzeProduct(productInput);

    // 4. Get or create product truth
    let truth = await getProductTruth(productId);
    if (!truth) {
      truth = await createProductTruth(
        result.projectId || productId, // Will be updated
        productId,
        analysis,
        productInput.images
      );
    }

    // 5. Get project ID
    const supabase = createAdminSupabaseClient();
    const { data: project } = await supabase
      .from('content_projects')
      .select('id')
      .eq('product_id', productId)
      .single();

    result.projectId = project?.id || productId;

    // 6. Generate content concepts
    result.status = 'generating';
    const contentPlan = await generateContentPlan(truth, result.projectId);
    result.conceptsGenerated = contentPlan.concepts.length;

    // 7. Save concepts to database
    for (const concept of contentPlan.concepts) {
      await supabase.from('content_concepts').insert({
        project_id: result.projectId,
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
        status: 'approved',
      });
    }

    // 8. Generate images for first concept
    result.status = 'assembling';
    try {
      const images = await generateProductImages(productId, truth, ['studio', 'lifestyle']);
      result.imagesGenerated = images.length;
    } catch (error) {
      result.errors.push(`Image generation: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 9. Generate voiceover for first concept
    let voiceoverPath: string | undefined;
    try {
      const firstConcept = contentPlan.concepts[0];
      if (firstConcept) {
        const voice = await generateVoiceover({
          productId,
          text: firstConcept.script,
          voice: { gender: 'female', emotion: 'warm' },
        });
        voiceoverPath = voice.path;
      }
    } catch (error) {
      result.errors.push(`Voice generation: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 10. Generate music
    let musicPath: string | undefined;
    try {
      const music = await generateMusic(productId, {
        mood: 'upbeat',
        durationSeconds: 15,
        instrumentalOnly: true,
      });
      musicPath = music.path;
    } catch (error) {
      result.errors.push(`Music generation: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 11. Run QA on concepts
    result.status = 'qa';
    for (const concept of contentPlan.concepts.slice(0, 3)) {
      const qaResult = await runCopyQA(concept.conceptType, {
        hook: concept.hook,
        caption: concept.caption,
        hashtags: concept.hashtags,
        voiceoverScript: concept.script,
      });
      await saveQAResult(qaResult);
    }

    // 12. Queue content for publishing
    result.status = 'queuing';
    for (const concept of contentPlan.concepts.slice(0, 3)) {
      await addToQueue({
        projectId: result.projectId,
        conceptId: concept.conceptType,
        platform: concept.platform === 'all' ? 'tiktok' : concept.platform,
        caption: concept.caption,
        hashtags: concept.hashtags,
      });
      result.itemsQueued++;
    }

    result.status = 'completed';
    return result;
  } catch (error) {
    result.status = 'failed';
    result.errors.push(error instanceof Error ? error.message : 'Pipeline failed');
    return result;
  }
}

/**
 * Get pipeline status for a product
 */
export async function getPipelineStatus(productId: string): Promise<{
  hasProject: boolean;
  status: string;
  conceptsCount: number;
  imagesCount: number;
  queueCount: number;
}> {
  const supabase = createAdminSupabaseClient();

  const { data: project } = await supabase
    .from('content_projects')
    .select('id, status')
    .eq('product_id', productId)
    .single();

  if (!project) {
    return { hasProject: false, status: 'none', conceptsCount: 0, imagesCount: 0, queueCount: 0 };
  }

  const [{ count: conceptsCount }, { count: imagesCount }, { count: queueCount }] = await Promise.all([
    supabase.from('content_concepts').select('*', { count: 'exact', head: true }).eq('project_id', project.id),
    supabase.from('media_assets').select('*', { count: 'exact', head: true }).eq('project_id', project.id).eq('asset_type', 'image'),
    supabase.from('content_queue').select('*', { count: 'exact', head: true }).eq('project_id', project.id),
  ]);

  return {
    hasProject: true,
    status: project.status,
    conceptsCount: conceptsCount || 0,
    imagesCount: imagesCount || 0,
    queueCount: queueCount || 0,
  };
}
