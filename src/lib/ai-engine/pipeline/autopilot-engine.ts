/**
 * ATEMI AI CONTENT ENGINE — Autopilot Engine
 *
 * Automates daily content generation and publishing.
 * Handles product rotation, scheduling, and global pause.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { runPipeline, getPipelineStatus } from '../pipeline/media-pipeline';
import { getProductRotation, loadScheduleConfig, getEligibleProducts } from '../scheduler/content-scheduler';
import { getPublishableItems, updateQueueItemStatus } from '../queue/content-queue';
import { publishContent } from '../publishing/publishing-engine';
import { canGenerate } from '../cost/cost-tracker';

// ============================================
// Types
// ============================================

export type AutopilotStatus = 'stopped' | 'running' | 'paused';

export interface AutopilotConfig {
  enabled: boolean;
  autoPublish: boolean;
  requireApproval: boolean;
  postsPerDay: number;
  platforms: string[];
  contentTypes: string[];
}

export interface AutopilotRunResult {
  timestamp: string;
  productsProcessed: number;
  conceptsGenerated: number;
  itemsQueued: number;
  itemsPublished: number;
  errors: string[];
}

// ============================================
// Autopilot Engine
// ============================================

/**
 * Load autopilot config from database
 */
export async function loadAutopilotConfig(): Promise<AutopilotConfig> {
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('category', 'autopilot');

  const settings = new Map((data || []).map((s) => [s.key, s.value]));

  const scheduleConfig = await loadScheduleConfig();

  return {
    enabled: settings.get('enabled') === 'true',
    autoPublish: settings.get('auto_publish') === 'true',
    requireApproval: settings.get('require_approval') !== 'false',
    postsPerDay: scheduleConfig.postsPerDay,
    platforms: scheduleConfig.platforms,
    contentTypes: scheduleConfig.contentTypes,
  };
}

/**
 * Update autopilot config
 */
export async function updateAutopilotConfig(config: Partial<AutopilotConfig>): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const updates: Array<{ category: string; key: string; value: string; description: string }> = [];

  if (config.enabled !== undefined) {
    updates.push({ category: 'autopilot', key: 'enabled', value: config.enabled.toString(), description: 'Mode autopilot activé' });
  }
  if (config.autoPublish !== undefined) {
    updates.push({ category: 'autopilot', key: 'auto_publish', value: config.autoPublish.toString(), description: 'Publication automatique' });
  }
  if (config.requireApproval !== undefined) {
    updates.push({ category: 'autopilot', key: 'require_approval', value: config.requireApproval.toString(), description: 'Validation requise' });
  }

  for (const update of updates) {
    await supabase
      .from('system_settings')
      .upsert(update, { onConflict: 'category,key' });
  }
}

/**
 * Get autopilot status
 */
export async function getAutopilotStatus(): Promise<{
  status: AutopilotStatus;
  config: AutopilotConfig;
  lastRun: string | null;
  nextRun: string | null;
}> {
  const config = await loadAutopilotConfig();
  const supabase = createAdminSupabaseClient();

  // Get last run
  const { data: lastRunData } = await supabase
    .from('audit_log')
    .select('created_at')
    .eq('action', 'autopilot_run')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Calculate next run (every 6 hours if enabled)
  let nextRun: string | null = null;
  if (config.enabled && lastRunData) {
    const lastRun = new Date(lastRunData.created_at);
    nextRun = new Date(lastRun.getTime() + 6 * 60 * 60 * 1000).toISOString();
  }

  return {
    status: config.enabled ? 'running' : 'stopped',
    config,
    lastRun: lastRunData?.created_at || null,
    nextRun,
  };
}

/**
 * Run autopilot cycle
 */
export async function runAutopilotCycle(): Promise<AutopilotRunResult> {
  const result: AutopilotRunResult = {
    timestamp: new Date().toISOString(),
    productsProcessed: 0,
    conceptsGenerated: 0,
    itemsQueued: 0,
    itemsPublished: 0,
    errors: [],
  };

  try {
    // 1. Check budget
    const budgetCheck = await canGenerate(1.00);
    if (!budgetCheck.allowed) {
      result.errors.push(`Budget limité: ${budgetCheck.reason}`);
      return result;
    }

    // 2. Get eligible products for rotation
    const rotation = await getProductRotation(5);

    // 3. Process each product
    for (const productId of rotation.slice(0, 3)) {
      try {
        // Check if product already has content
        const status = await getPipelineStatus(productId);
        if (status.hasProject && status.conceptsCount >= 3) {
          continue; // Skip products with enough content
        }

        // Run pipeline
        const pipelineResult = await runPipeline(productId);
        result.productsProcessed++;
        result.conceptsGenerated += pipelineResult.conceptsGenerated;
        result.itemsQueued += pipelineResult.itemsQueued;

        if (pipelineResult.errors.length > 0) {
          result.errors.push(...pipelineResult.errors.map((e) => `${productId}: ${e}`));
        }
      } catch (error) {
        result.errors.push(`Pipeline failed for ${productId}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // 4. Auto-publish if enabled
    const config = await loadAutopilotConfig();
    if (config.autoPublish && !config.requireApproval) {
      const publishable = await getPublishableItems(3);
      for (const item of publishable) {
        try {
          await publishContent(item, '');
          result.itemsPublished++;
        } catch (error) {
          result.errors.push(`Publish failed for ${item.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    }

    // 5. Log run
    const supabase = createAdminSupabaseClient();
    await supabase.from('audit_log').insert({
      action: 'autopilot_run',
      entity_type: 'system',
      new_data: result as unknown as Record<string, unknown>,
    });

    return result;
  } catch (error) {
    result.errors.push(`Autopilot cycle failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return result;
  }
}

/**
 * Pause all future content
 */
export async function pauseAutopilot(): Promise<void> {
  await updateAutopilotConfig({ enabled: false });
}

/**
 * Resume autopilot
 */
export async function resumeAutopilot(): Promise<void> {
  await updateAutopilotConfig({ enabled: true });
}
