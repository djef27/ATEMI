/**
 * API: Content Queue
 * GET /api/content-engine/queue - List queue items
 * POST /api/content-engine/queue - Add to queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import { getQueueItems, addToQueue, getQueueStats } from '@/lib/ai-engine/queue/content-queue';

export const GET = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'draft' | 'ready' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled' | null;
    const platform = searchParams.get('platform');
    const stats = searchParams.get('stats') === 'true';

    if (stats) {
      const queueStats = await getQueueStats();
      return NextResponse.json({ success: true, data: queueStats });
    }

    const items = await getQueueItems({
      status: status || undefined,
      platform: platform || undefined,
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('[CONTENT_ENGINE_QUEUE_GET_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture de la file d\'attente' },
      { status: 500 }
    );
  }
});

export const POST = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { projectId, conceptId, platform, mediaAssetId, caption, hashtags, scheduledAt } = body;

    if (!projectId || !platform) {
      return NextResponse.json(
        { success: false, error: 'projectId et platform requis' },
        { status: 400 }
      );
    }

    const item = await addToQueue({
      projectId,
      conceptId,
      platform,
      mediaAssetId,
      caption,
      hashtags,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('[CONTENT_ENGINE_QUEUE_POST_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'ajout à la file d\'attente' },
      { status: 500 }
    );
  }
});
