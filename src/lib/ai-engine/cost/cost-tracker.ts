/**
 * ATEMI AI CONTENT ENGINE — Cost Tracker
 *
 * Tracks AI generation costs and enforces budget limits.
 * Stores usage records in Supabase.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';

export interface CostLimits {
  maxDailyCost: number;
  maxMonthlyCost: number;
  maxDailyGenerations: number;
  maxMonthlyGenerations: number;
}

export interface CostSummary {
  dailyCost: number;
  monthlyCost: number;
  dailyGenerations: number;
  monthlyGenerations: number;
  limits: CostLimits;
  dailyLimitReached: boolean;
  monthlyLimitReached: boolean;
}

const DEFAULT_LIMITS: CostLimits = {
  maxDailyCost: 5.00,
  maxMonthlyCost: 50.00,
  maxDailyGenerations: 100,
  maxMonthlyGenerations: 2000,
};

/**
 * Load cost limits from database
 */
async function loadLimits(): Promise<CostLimits> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'budget');

    if (!data || data.length === 0) {
      return DEFAULT_LIMITS;
    }

    const settings = new Map(data.map((s) => [s.key, s.value]));

    return {
      maxDailyCost: parseFloat(settings.get('max_daily_cost')) || DEFAULT_LIMITS.maxDailyCost,
      maxMonthlyCost: parseFloat(settings.get('max_monthly_cost')) || DEFAULT_LIMITS.maxMonthlyCost,
      maxDailyGenerations: parseInt(settings.get('max_daily_generations')) || DEFAULT_LIMITS.maxDailyGenerations,
      maxMonthlyGenerations: parseInt(settings.get('max_monthly_generations')) || DEFAULT_LIMITS.maxMonthlyGenerations,
    };
  } catch {
    return DEFAULT_LIMITS;
  }
}

/**
 * Get current cost summary
 */
export async function getCostSummary(): Promise<CostSummary> {
  const supabase = createAdminSupabaseClient();
  const limits = await loadLimits();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Daily stats
  const { data: dailyData } = await supabase
    .from('usage_records')
    .select('cost')
    .gte('recorded_at', startOfDay.toISOString());

  const dailyCost = (dailyData || []).reduce((sum, r) => sum + (r.cost || 0), 0);
  const dailyGenerations = dailyData?.length || 0;

  // Monthly stats
  const { data: monthlyData } = await supabase
    .from('usage_records')
    .select('cost')
    .gte('recorded_at', startOfMonth.toISOString());

  const monthlyCost = (monthlyData || []).reduce((sum, r) => sum + (r.cost || 0), 0);
  const monthlyGenerations = monthlyData?.length || 0;

  return {
    dailyCost,
    monthlyCost,
    dailyGenerations,
    monthlyGenerations,
    limits,
    dailyLimitReached: dailyCost >= limits.maxDailyCost || dailyGenerations >= limits.maxDailyGenerations,
    monthlyLimitReached: monthlyCost >= limits.maxMonthlyCost || monthlyGenerations >= limits.maxMonthlyGenerations,
  };
}

/**
 * Check if a generation is allowed within budget
 */
export async function canGenerate(estimatedCost: number = 0): Promise<{
  allowed: boolean;
  reason?: string;
  summary: CostSummary;
}> {
  const summary = await getCostSummary();

  if (summary.dailyLimitReached) {
    return {
      allowed: false,
      reason: 'Daily limit reached. Try again tomorrow.',
      summary,
    };
  }

  if (summary.monthlyLimitReached) {
    return {
      allowed: false,
      reason: 'Monthly limit reached. Contact admin to increase budget.',
      summary,
    };
  }

  if (estimatedCost > 0 && summary.dailyCost + estimatedCost > summary.limits.maxDailyCost) {
    return {
      allowed: false,
      reason: `This generation would exceed daily budget ($${(summary.dailyCost + estimatedCost).toFixed(2)} > $${summary.limits.maxDailyCost}).`,
      summary,
    };
  }

  return { allowed: true, summary };
}

/**
 * Record a usage event
 */
export async function recordUsage(params: {
  provider: string;
  jobId?: string;
  operationType: string;
  units?: number;
  cost: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();

  await supabase.from('usage_records').insert({
    provider: params.provider,
    job_id: params.jobId || null,
    operation_type: params.operationType,
    units_used: params.units || 1,
    cost: params.cost,
    metadata: params.metadata || {},
  });
}

/**
 * Update cost limits
 */
export async function updateLimits(limits: Partial<CostLimits>): Promise<void> {
  const supabase = createAdminSupabaseClient();

  if (limits.maxDailyCost !== undefined) {
    await supabase
      .from('system_settings')
      .upsert(
        { category: 'budget', key: 'max_daily_cost', value: limits.maxDailyCost.toString(), description: 'Budget max journalier en USD' },
        { onConflict: 'category,key' }
      );
  }

  if (limits.maxMonthlyCost !== undefined) {
    await supabase
      .from('system_settings')
      .upsert(
        { category: 'budget', key: 'max_monthly_cost', value: limits.maxMonthlyCost.toString(), description: 'Budget max mensuel en USD' },
        { onConflict: 'category,key' }
      );
  }

  if (limits.maxDailyGenerations !== undefined) {
    await supabase
      .from('system_settings')
      .upsert(
        { category: 'budget', key: 'max_daily_generations', value: limits.maxDailyGenerations.toString(), description: 'Générations max par jour' },
        { onConflict: 'category,key' }
      );
  }

  if (limits.maxMonthlyGenerations !== undefined) {
    await supabase
      .from('system_settings')
      .upsert(
        { category: 'budget', key: 'max_monthly_generations', value: limits.maxMonthlyGenerations.toString(), description: 'Générations max par mois' },
        { onConflict: 'category,key' }
      );
  }
}
