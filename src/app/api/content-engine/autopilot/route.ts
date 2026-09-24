/**
 * API: Autopilot
 * GET /api/content-engine/autopilot - Get status
 * POST /api/content-engine/autopilot - Run cycle / pause / resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { withContentAdminAuth } from '@/lib/ai-engine/config/feature-flag';
import {
  getAutopilotStatus,
  runAutopilotCycle,
  pauseAutopilot,
  resumeAutopilot,
  updateAutopilotConfig,
} from '@/lib/ai-engine/pipeline/autopilot-engine';

export const GET = withContentAdminAuth(async () => {
  try {
    const status = await getAutopilotStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error('[CONTENT_ENGINE_AUTOPILOT_GET_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture du statut autopilot' },
      { status: 500 }
    );
  }
});

export const POST = withContentAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'run': {
        const result = await runAutopilotCycle();
        return NextResponse.json({ success: true, data: result });
      }

      case 'pause': {
        await pauseAutopilot();
        return NextResponse.json({ success: true, message: 'Autopilot mis en pause' });
      }

      case 'resume': {
        await resumeAutopilot();
        return NextResponse.json({ success: true, message: 'Autopilot réactivé' });
      }

      case 'update_config': {
        await updateAutopilotConfig(config);
        return NextResponse.json({ success: true, message: 'Configuration mise à jour' });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Action invalide' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[CONTENT_ENGINE_AUTOPILOT_POST_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'exécution de l\'action autopilot' },
      { status: 500 }
    );
  }
});
