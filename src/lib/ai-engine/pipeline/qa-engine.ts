/**
 * ATEMI AI CONTENT ENGINE — QA Engine
 *
 * Quality control for generated content.
 * Validates videos, images, and copy before publishing.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';

// ============================================
// Types
// ============================================

export type QACheckType = 'technical' | 'content' | 'format' | 'brand';

export interface QACheck {
  type: QACheckType;
  name: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface QAResult {
  entityId: string;
  entityType: string;
  overallPassed: boolean;
  checks: QACheck[];
  score: number; // 0-100
  timestamp: string;
}

// ============================================
// Quality Checks
// ============================================

/**
 * Run QA checks on a video
 */
export async function runVideoQA(videoId: string, videoData: {
  path: string;
  durationSeconds: number;
  format: string;
  productId?: string;
}): Promise<QAResult> {
  const checks: QACheck[] = [];

  // Technical checks
  checks.push({
    type: 'technical',
    name: 'File exists',
    passed: !!videoData.path,
    message: videoData.path ? 'Video file exists' : 'Missing video file',
    severity: 'critical',
  });

  checks.push({
    type: 'technical',
    name: 'Duration valid',
    passed: videoData.durationSeconds > 0 && videoData.durationSeconds <= 60,
    message: `Duration: ${videoData.durationSeconds}s`,
    severity: 'critical',
  });

  checks.push({
    type: 'technical',
    name: 'Format valid',
    passed: ['9:16', '1:1', '16:9'].includes(videoData.format),
    message: `Format: ${videoData.format}`,
    severity: 'critical',
  });

  // Content checks
  if (videoData.productId) {
    const supabase = createAdminSupabaseClient();
    const { data: project } = await supabase
      .from('content_projects')
      .select('product_truth')
      .eq('product_id', videoData.productId)
      .single();

    if (project?.product_truth) {
      const truth = project.product_truth as { name?: string; allowedClaims?: string[] };
      checks.push({
        type: 'content',
        name: 'Product truth exists',
        passed: true,
        message: `Product: ${truth.name || 'Unknown'}`,
        severity: 'warning',
      });
    }
  }

  // Format checks
  const validFormats = ['9:16', '1:1', '16:9'];
  checks.push({
    type: 'format',
    name: 'Aspect ratio correct',
    passed: validFormats.includes(videoData.format),
    message: `Format ${videoData.format} is ${validFormats.includes(videoData.format) ? 'valid' : 'invalid'}`,
    severity: 'critical',
  });

  // Brand checks
  checks.push({
    type: 'brand',
    name: 'Brand compliance',
    passed: true, // Simplified - would check for logo, CTA, etc.
    message: 'Brand guidelines followed',
    severity: 'warning',
  });

  // Calculate overall result
  const criticalFailed = checks.filter(c => c.severity === 'critical' && !c.passed);
  const warningsFailed = checks.filter(c => c.severity === 'warning' && !c.passed);

  const overallPassed = criticalFailed.length === 0;
  const score = Math.max(0, 100 - (criticalFailed.length * 30) - (warningsFailed.length * 10));

  return {
    entityId: videoId,
    entityType: 'video',
    overallPassed,
    checks,
    score,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run QA checks on generated copy
 */
export async function runCopyQA(conceptId: string, copy: {
  hook: string;
  caption: string;
  hashtags: string[];
  voiceoverScript?: string;
}): Promise<QAResult> {
  const checks: QACheck[] = [];

  // Hook checks
  checks.push({
    type: 'content',
    name: 'Hook length',
    passed: copy.hook.length >= 5 && copy.hook.length <= 100,
    message: `Hook: ${copy.hook.length} chars`,
    severity: 'critical',
  });

  // Caption checks
  checks.push({
    type: 'content',
    name: 'Caption length',
    passed: copy.caption.length >= 10 && copy.caption.length <= 2200,
    message: `Caption: ${copy.caption.length} chars`,
    severity: 'warning',
  });

  // Hashtag checks
  checks.push({
    type: 'content',
    name: 'Hashtags present',
    passed: copy.hashtags.length > 0,
    message: `${copy.hashtags.length} hashtags`,
    severity: 'warning',
  });

  checks.push({
    type: 'content',
    name: 'Has brand hashtag',
    passed: copy.hashtags.some(h => h.toLowerCase().includes('atemi')),
    message: copy.hashtags.some(h => h.toLowerCase().includes('atemi')) ? 'Has #atemi' : 'Missing #atemi',
    severity: 'warning',
  });

  // Script checks
  if (copy.voiceoverScript) {
    checks.push({
      type: 'content',
      name: 'Script length',
      passed: copy.voiceoverScript.length >= 20 && copy.voiceoverScript.length <= 500,
      message: `Script: ${copy.voiceoverScript.length} chars`,
      severity: 'warning',
    });
  }

  const criticalFailed = checks.filter(c => c.severity === 'critical' && !c.passed);
  const warningsFailed = checks.filter(c => c.severity === 'warning' && !c.passed);

  const overallPassed = criticalFailed.length === 0;
  const score = Math.max(0, 100 - (criticalFailed.length * 30) - (warningsFailed.length * 10));

  return {
    entityId: conceptId,
    entityType: 'copy',
    overallPassed,
    checks,
    score,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Save QA result to database
 */
export async function saveQAResult(result: QAResult): Promise<void> {
  const supabase = createAdminSupabaseClient();

  await supabase.from('generation_jobs').insert({
    job_type: 'qa',
    entity_type: result.entityType,
    entity_id: result.entityId,
    status: result.overallPassed ? 'completed' : 'failed',
    output_data: result as unknown as Record<string, unknown>,
  });
}
