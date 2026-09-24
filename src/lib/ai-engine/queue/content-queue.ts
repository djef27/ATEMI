/**
 * ATEMI AI CONTENT ENGINE — Content Queue
 *
 * Manages the queue of content ready for publishing.
 * Handles status transitions and scheduling.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';

// ============================================
// Types
// ============================================

export type QueueStatus = 'draft' | 'ready' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface QueueItem {
  id: string;
  projectId: string;
  conceptId: string | null;
  platform: string;
  mediaAssetId: string | null;
  caption: string | null;
  hashtags: string[] | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformPostId: string | null;
  status: QueueStatus;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
}

// ============================================
// Queue Management
// ============================================

/**
 * Add content to the queue
 */
export async function addToQueue(params: {
  projectId: string;
  conceptId?: string;
  platform: string;
  mediaAssetId?: string;
  caption?: string;
  hashtags?: string[];
  scheduledAt?: Date;
}): Promise<QueueItem> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('content_queue')
    .insert({
      project_id: params.projectId,
      concept_id: params.conceptId || null,
      platform: params.platform,
      media_asset_id: params.mediaAssetId || null,
      caption: params.caption || null,
      hashtags: params.hashtags || [],
      scheduled_at: params.scheduledAt?.toISOString() || null,
      status: params.scheduledAt ? 'scheduled' : 'ready',
    })
    .select()
    .single();

  if (error) throw error;
  return data as QueueItem;
}

/**
 * Get items in queue
 */
export async function getQueueItems(params?: {
  status?: QueueStatus;
  platform?: string;
  limit?: number;
  offset?: number;
}): Promise<QueueItem[]> {
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from('content_queue')
    .select('*')
    .order('scheduled_at', { ascending: true });

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.platform) {
    query = query.eq('platform', params.platform);
  }

  const { data, error } = await query
    .range(params?.offset || 0, (params?.offset || 0) + (params?.limit || 50) - 1);

  if (error) throw error;
  return (data || []) as QueueItem[];
}

/**
 * Get next items to publish
 */
export async function getPublishableItems(limit: number = 10): Promise<QueueItem[]> {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('content_queue')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as QueueItem[];
}

/**
 * Update queue item status
 */
export async function updateQueueItemStatus(
  id: string,
  status: QueueStatus,
  metadata?: { platformPostId?: string; errorMessage?: string }
): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const update: Record<string, unknown> = { status };

  if (metadata?.platformPostId) {
    update.platform_post_id = metadata.platformPostId;
    update.published_at = new Date().toISOString();
  }

  if (metadata?.errorMessage) {
    update.error_message = metadata.errorMessage;
    update.retry_count = 1; // Would increment properly in production
  }

  await supabase
    .from('content_queue')
    .update(update)
    .eq('id', id);
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  total: number;
  byStatus: Record<QueueStatus, number>;
  byPlatform: Record<string, number>;
}> {
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from('content_queue')
    .select('status, platform');

  const items = data || [];
  const byStatus: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1;
  }

  return {
    total: items.length,
    byStatus: byStatus as Record<QueueStatus, number>,
    byPlatform,
  };
}
