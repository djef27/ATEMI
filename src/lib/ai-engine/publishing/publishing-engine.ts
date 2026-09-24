/**
 * ATEMI AI CONTENT ENGINE — Publishing Engine
 *
 * Manages publishing to social media platforms.
 * Handles authentication, upload, scheduling, and error recovery.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { updateQueueItemStatus, type QueueItem } from '../queue/content-queue';

// ============================================
// Types
// ============================================

export type Platform = 'tiktok' | 'instagram' | 'facebook' | 'youtube';

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  retryAfter?: number;
}

export interface PlatformAdapter {
  name: Platform;
  publish(params: PublishParams): Promise<PublishResult>;
  getAuthUrl(): string;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }>;
}

export interface PublishParams {
  videoPath: string;
  caption: string;
  hashtags: string[];
  scheduledAt?: Date;
}

// ============================================
// Platform Adapters (Stubs)
// ============================================

/**
 * TikTok Adapter
 */
const TikTokAdapter: PlatformAdapter = {
  name: 'tiktok',

  async publish(params: PublishParams): Promise<PublishResult> {
    // TikTok Content Posting API
    // Documentation: https://developers.tiktok.com/doc/content-posting-api
    console.log('Publishing to TikTok:', params.caption);
    return { success: true, platformPostId: `tiktok_${Date.now()}` };
  },

  getAuthUrl(): string {
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&response_type=code&scope=video.upload,video.publish&redirect_uri=${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;
  },

  async refreshToken(refreshToken: string) {
    // Would call TikTok token refresh endpoint
    return {
      accessToken: 'new_token',
      expiresAt: new Date(Date.now() + 3600_000),
    };
  },
};

/**
 * Instagram Adapter (via Facebook Graph API)
 */
const InstagramAdapter: PlatformAdapter = {
  name: 'instagram',

  async publish(params: PublishParams): Promise<PublishResult> {
    // Instagram Graph API
    // Documentation: https://developers.facebook.com/docs/instagram-api
    console.log('Publishing to Instagram:', params.caption);
    return { success: true, platformPostId: `ig_${Date.now()}` };
  },

  getAuthUrl(): string {
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback&scope=pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish`;
  },

  async refreshToken(refreshToken: string) {
    return {
      accessToken: 'new_token',
      expiresAt: new Date(Date.now() + 60 * 24 * 3600_000), // 60 days
    };
  },
};

/**
 * Facebook Adapter (via Graph API)
 */
const FacebookAdapter: PlatformAdapter = {
  name: 'facebook',

  async publish(params: PublishParams): Promise<PublishResult> {
    // Facebook Graph API
    // Documentation: https://developers.facebook.com/docs/pages-api
    console.log('Publishing to Facebook:', params.caption);
    return { success: true, platformPostId: `fb_${Date.now()}` };
  },

  getAuthUrl(): string {
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback&scope=pages_manage_posts,pages_read_engagement`;
  },

  async refreshToken(refreshToken: string) {
    return {
      accessToken: 'new_token',
      expiresAt: new Date(Date.now() + 60 * 24 * 3600_000),
    };
  },
};

// ============================================
// Adapter Registry
// ============================================

const adapters: Record<Platform, PlatformAdapter> = {
  tiktok: TikTokAdapter,
  instagram: InstagramAdapter,
  facebook: FacebookAdapter,
  youtube: TikTokAdapter, // Stub - would be YouTube adapter
};

/**
 * Get adapter for a platform
 */
export function getAdapter(platform: Platform): PlatformAdapter {
  return adapters[platform];
}

// ============================================
// Publishing
// ============================================

/**
 * Publish content to a platform
 */
export async function publishContent(
  queueItem: QueueItem,
  videoPath: string
): Promise<PublishResult> {
  const platform = queueItem.platform as Platform;
  const adapter = getAdapter(platform);

  await updateQueueItemStatus(queueItem.id, 'publishing');

  try {
    const result = await adapter.publish({
      videoPath,
      caption: queueItem.caption || '',
      hashtags: queueItem.hashtags || [],
    });

    if (result.success) {
      await updateQueueItemStatus(queueItem.id, 'published', {
        platformPostId: result.platformPostId,
      });
    } else {
      await updateQueueItemStatus(queueItem.id, 'failed', {
        errorMessage: result.error,
      });
    }

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Publish failed';
    await updateQueueItemStatus(queueItem.id, 'failed', {
      errorMessage: errMsg,
    });
    return { success: false, error: errMsg };
  }
}

/**
 * Get platform accounts
 */
export async function getPlatformAccounts(platform?: Platform): Promise<Array<{
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
}>> {
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from('platform_accounts')
    .select('id, platform, account_name, is_active');

  if (platform) {
    query = query.eq('platform', platform);
  }

  const { data } = await query;
  return (data || []).map((item) => ({
    id: item.id as string,
    platform: item.platform as string,
    accountName: item.account_name as string,
    isActive: item.is_active as boolean,
  }));
}

/**
 * Save platform account
 */
export async function savePlatformAccount(params: {
  platform: Platform;
  accountName: string;
  accountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();

  await supabase.from('platform_accounts').upsert({
    platform: params.platform,
    account_name: params.accountName,
    account_id: params.accountId,
    access_token: params.accessToken || null,
    refresh_token: params.refreshToken || null,
    token_expires_at: params.expiresAt?.toISOString() || null,
    scope: params.scope || null,
    is_active: true,
  }, { onConflict: 'platform,account_id' });
}
