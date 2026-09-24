/** @jest-environment node */
/**
 * Content Engine Feature Flag Tests
 *
 * The AI Content Engine is gated behind CONTENT_ENGINE_ENABLED (fail-closed):
 * - disabled by default (no AI providers, publishing adapters are stubs)
 * - every content-engine API route must use withContentAdminAuth
 * - no other route is affected
 */

import { isContentEngineEnabled } from '@/lib/ai-engine/config/enabled';

describe('Content Engine feature flag', () => {
  it('is disabled by default', () => {
    delete process.env.CONTENT_ENGINE_ENABLED;
    expect(isContentEngineEnabled()).toBe(false);
  });

  it('enables only with an explicit "true"', () => {
    process.env.CONTENT_ENGINE_ENABLED = 'true';
    expect(isContentEngineEnabled()).toBe(true);

    process.env.CONTENT_ENGINE_ENABLED = '1';
    expect(isContentEngineEnabled()).toBe(false);

    process.env.CONTENT_ENGINE_ENABLED = 'TRUE';
    expect(isContentEngineEnabled()).toBe(false);

    delete process.env.CONTENT_ENGINE_ENABLED;
  });
});

describe('Content Engine API routes are gated', () => {
  const fs = require('fs');
  const path = require('path');
  const base = path.join(process.cwd(), 'src/app/api/content-engine');

  const routes = [
    'settings/route.ts',
    'schedule/route.ts',
    'queue/route.ts',
    'publish/route.ts',
    'generations/route.ts',
    'autopilot/route.ts',
    'products/[id]/concepts/route.ts',
    'products/[id]/analyze/route.ts',
  ];

  for (const route of routes) {
    it(`${route} uses withContentAdminAuth`, () => {
      const content = fs.readFileSync(path.join(base, route), 'utf-8');
      expect(content).toContain('withContentAdminAuth');
      expect(content).toContain('@/lib/ai-engine/config/feature-flag');
      expect(content).not.toContain('withAdminAuth');
    });
  }
});

describe('Non-content admin routes are not gated', () => {
  const fs = require('fs');
  const path = require('path');

  it('orders [id] route keeps its own withAdminAuth', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/admin/orders/[id]/route.ts'),
      'utf-8'
    );
    expect(route).toContain('withAdminAuth');
    expect(route).not.toContain('withContentAdminAuth');
  });
});