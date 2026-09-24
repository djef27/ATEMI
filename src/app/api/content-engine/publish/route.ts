/**
 * API: Publish content
 * POST /api/content-engine/publish - Publish a queue item
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import { publishContent } from '@/lib/ai-engine/publishing/publishing-engine';
import { getQueueItems } from '@/lib/ai-engine/queue/content-queue';

export const POST = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { queueItemId, videoPath } = body;

    if (!queueItemId) {
      return NextResponse.json(
        { success: false, error: 'queueItemId requis' },
        { status: 400 }
      );
    }

    // Get queue item
    const items = await getQueueItems({ status: 'ready' });
    const item = items.find((i) => i.id === queueItemId);

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Élément non trouvé ou non prêt' },
        { status: 404 }
      );
    }

    // Publish
    const result = await publishContent(item, videoPath || '');

    return NextResponse.json({
      success: result.success,
      data: {
        platformPostId: result.platformPostId,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('[CONTENT_ENGINE_PUBLISH_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la publication du contenu' },
      { status: 500 }
    );
  }
});
