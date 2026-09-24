/**
 * ATEMI AI CONTENT ENGINE — Content Scheduler
 *
 * Manages content scheduling, product rotation,
 * and daily automation.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { addToQueue, getQueueItems } from '../queue/content-queue';

// ============================================
// Types
// ============================================

export interface ScheduleConfig {
  postsPerDay: number;
  postingTimes: string[]; // ["08:00", "14:00", "20:00"]
  platforms: string[];
  activeProducts: string[];
  contentTypes: string[];
}

export interface ScheduledPost {
  productId: string;
  conceptId: string;
  platform: string;
  scheduledAt: Date;
}

// ============================================
// Scheduling
// ============================================

/**
 * Load schedule config from database
 */
export async function loadScheduleConfig(): Promise<ScheduleConfig> {
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('category', 'posting');

  const settings = new Map((data || []).map((s) => [s.key, s.value]));

  return {
    postsPerDay: parseInt(settings.get('posts_per_day')) || 3,
    postingTimes: JSON.parse(settings.get('posting_times') || '["08:00","14:00","20:00"]'),
    platforms: JSON.parse(settings.get('active_platforms') || '["tiktok","instagram","facebook"]'),
    activeProducts: JSON.parse(settings.get('active_products') || '[]'),
    contentTypes: JSON.parse(settings.get('content_types') || '["ugc","product_showcase","lifestyle"]'),
  };
}

/**
 * Get products eligible for content generation
 */
export async function getEligibleProducts(limit: number = 10): Promise<Array<{
  id: string;
  name: string;
  categoryId: string;
  status: string;
}>> {
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from('products')
    .select('id, name, category_id, status')
    .eq('status', 'active')
    .limit(limit);

  return (data || []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    categoryId: p.category_id as string,
    status: p.status as string,
  }));
}

/**
 * Get product rotation (avoid repeating same product)
 */
export async function getProductRotation(count: number): Promise<string[]> {
  const supabase = createAdminSupabaseClient();

  // Get products that haven't been used recently
  const { data: recentProjects } = await supabase
    .from('content_projects')
    .select('product_id')
    .order('updated_at', { ascending: false })
    .limit(20);

  const recentIds = new Set((recentProjects || []).map((p) => p.product_id));

  // Get all active products
  const { data: allProducts } = await supabase
    .from('products')
    .select('id')
    .eq('status', 'active');

  const products = (allProducts || []).map((p) => p.id);

  // Prioritize products not used recently
  const unused = products.filter((id) => !recentIds.has(id));
  const used = products.filter((id) => recentIds.has(id));

  // Combine: unused first, then used (for rotation)
  const rotation = [...unused, ...used];

  return rotation.slice(0, count);
}

/**
 * Schedule content for today
 */
export async function scheduleForToday(
  projectId: string,
  conceptId: string,
  platform: string
): Promise<void> {
  const config = await loadScheduleConfig();
  const now = new Date();

  // Find next available time slot
  for (const time of config.postingTimes) {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(now);
    scheduledAt.setHours(hours, minutes, 0, 0);

    // Skip if time has passed
    if (scheduledAt <= now) continue;

    // Check if slot is available
    const existing = await getQueueItems({
      status: 'scheduled',
      platform,
    });

    const slotOccupied = existing.some((item) => {
      if (!item.scheduledAt) return false;
      const itemTime = new Date(item.scheduledAt);
      return Math.abs(itemTime.getTime() - scheduledAt.getTime()) < 3600_000; // 1 hour window
    });

    if (!slotOccupied) {
      await addToQueue({
        projectId,
        conceptId,
        platform,
        scheduledAt,
      });
      return;
    }
  }

  // No slot available today, schedule for tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [hours, minutes] = config.postingTimes[0].split(':').map(Number);
  tomorrow.setHours(hours, minutes, 0, 0);

  await addToQueue({
    projectId,
    conceptId,
    platform,
    scheduledAt: tomorrow,
  });
}

/**
 * Get today's schedule
 */
export async function getTodaySchedule(): Promise<Array<{
  time: string;
  platform: string;
  productName: string;
  status: string;
}>> {
  const supabase = createAdminSupabaseClient();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data } = await supabase
    .from('content_queue')
    .select(`
      scheduled_at, platform, status,
      content_projects(product_id, products(name))
    `)
    .gte('scheduled_at', startOfDay.toISOString())
    .lt('scheduled_at', endOfDay.toISOString())
    .order('scheduled_at', { ascending: true });

  return (data || []).map((item: Record<string, unknown>) => ({
    time: new Date(item.scheduled_at as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    platform: item.platform as string,
    productName: ((item.content_projects as Record<string, unknown>)?.products as Record<string, unknown>)?.name as string || 'Unknown',
    status: item.status as string,
  }));
}
