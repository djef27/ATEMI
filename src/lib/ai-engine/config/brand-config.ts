/**
 * ATEMI AI CONTENT ENGINE — Brand Configuration
 *
 * Manages brand identity for content generation.
 * Loads from Supabase system_settings table.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';

export interface BrandConfig {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  defaultLanguage: string;
  defaultCTA: string;
  logoUrl?: string;
  watermarkUrl?: string;
  fontFamily?: string;
}

const DEFAULT_BRAND: BrandConfig = {
  brandName: 'Atémi',
  primaryColor: '#C5A880',
  secondaryColor: '#1A1919',
  accentColor: '#D4A0A0',
  defaultLanguage: 'fr',
  defaultCTA: 'Commandez maintenant',
};

let cachedConfig: BrandConfig | null = null;
let cacheExpiry: Date | null = null;

/**
 * Load brand config from database (with 1-hour cache)
 */
export async function loadBrandConfig(): Promise<BrandConfig> {
  // Return cached if valid
  if (cachedConfig && cacheExpiry && cacheExpiry > new Date()) {
    return cachedConfig;
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'brand');

    if (!data || data.length === 0) {
      return DEFAULT_BRAND;
    }

    const settings = new Map(data.map((s) => [s.key, s.value]));

    cachedConfig = {
      brandName: settings.get('brand_name') || DEFAULT_BRAND.brandName,
      primaryColor: settings.get('primary_color') || DEFAULT_BRAND.primaryColor,
      secondaryColor: settings.get('secondary_color') || DEFAULT_BRAND.secondaryColor,
      accentColor: settings.get('accent_color') || DEFAULT_BRAND.accentColor,
      defaultLanguage: settings.get('default_language') || DEFAULT_BRAND.defaultLanguage,
      defaultCTA: settings.get('default_cta') || DEFAULT_BRAND.defaultCTA,
      logoUrl: settings.get('logo_url') || undefined,
      watermarkUrl: settings.get('watermark_url') || undefined,
      fontFamily: settings.get('font_family') || undefined,
    };

    cacheExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return cachedConfig;
  } catch {
    return DEFAULT_BRAND;
  }
}

/**
 * Save brand config to database
 */
export async function saveBrandConfig(config: Partial<BrandConfig>): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const updates: Array<{ category: string; key: string; value: unknown; description: string }> = [];

  if (config.brandName !== undefined) {
    updates.push({ category: 'brand', key: 'brand_name', value: config.brandName, description: 'Nom de la marque' });
  }
  if (config.primaryColor !== undefined) {
    updates.push({ category: 'brand', key: 'primary_color', value: config.primaryColor, description: 'Couleur principale' });
  }
  if (config.secondaryColor !== undefined) {
    updates.push({ category: 'brand', key: 'secondary_color', value: config.secondaryColor, description: 'Couleur secondaire' });
  }
  if (config.accentColor !== undefined) {
    updates.push({ category: 'brand', key: 'accent_color', value: config.accentColor, description: 'Couleur accent' });
  }
  if (config.defaultLanguage !== undefined) {
    updates.push({ category: 'brand', key: 'default_language', value: config.defaultLanguage, description: 'Langue par défaut' });
  }
  if (config.defaultCTA !== undefined) {
    updates.push({ category: 'brand', key: 'default_cta', value: config.defaultCTA, description: 'CTA par défaut' });
  }

  for (const update of updates) {
    await supabase
      .from('system_settings')
      .upsert(update, { onConflict: 'category,key' });
  }

  // Invalidate cache
  cachedConfig = null;
  cacheExpiry = null;
}

/**
 * Invalidate brand config cache
 */
export function invalidateBrandCache(): void {
  cachedConfig = null;
  cacheExpiry = null;
}
