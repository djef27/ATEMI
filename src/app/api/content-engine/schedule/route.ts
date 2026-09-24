/**
 * API: Schedule
 * GET /api/content-engine/schedule - Get today's schedule
 * POST /api/content-engine/schedule - Schedule content
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import { getTodaySchedule, scheduleForToday, loadScheduleConfig } from '@/lib/ai-engine/scheduler/content-scheduler';

export const GET = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const schedule = await getTodaySchedule();
    const config = await loadScheduleConfig();

    return NextResponse.json({
      success: true,
      data: { schedule, config },
    });
  } catch (error) {
    console.error('[CONTENT_ENGINE_SCHEDULE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture du planning' },
      { status: 500 }
    );
  }
});

export const POST = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { projectId, conceptId, platform } = body;

    if (!projectId || !conceptId || !platform) {
      return NextResponse.json(
        { success: false, error: 'projectId, conceptId et platform requis' },
        { status: 400 }
      );
    }

    await scheduleForToday(projectId, conceptId, platform);

    return NextResponse.json({
      success: true,
      message: 'Contenu programmé',
    });
  } catch (error) {
    console.error('[CONTENT_ENGINE_SCHEDULE_CREATE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la programmation du contenu' },
      { status: 500 }
    );
  }
});
