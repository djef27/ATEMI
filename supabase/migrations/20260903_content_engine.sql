-- ============================================
-- ATEMI AI CONTENT ENGINE — Database Schema
-- Migration: 20260903_content_engine
-- ============================================

-- ============================================
-- 1. CONTENT PROJECTS (un par produit)
-- ============================================
CREATE TABLE IF NOT EXISTS content_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'analyzing', 'analyzed', 'generating', 'ready', 'active', 'archived')),
  product_truth JSONB,
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

CREATE INDEX idx_content_projects_product ON content_projects(product_id);
CREATE INDEX idx_content_projects_status ON content_projects(status);

-- ============================================
-- 2. CONTENT CONCEPTS (UGC, lifestyle, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS content_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
  concept_type TEXT NOT NULL CHECK (concept_type IN ('ugc', 'product_showcase', 'lifestyle', 'problem_solution', 'before_after', 'three_ways', 'product_details', 'storytelling', 'promotional', 'premium_commercial')),
  hook TEXT,
  angle TEXT,
  script TEXT,
  visual_direction TEXT,
  voice_direction TEXT,
  cta TEXT,
  caption TEXT,
  hashtags TEXT[],
  duration_seconds INTEGER,
  platform TEXT CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'youtube', 'all')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'generating', 'generated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_concepts_project ON content_concepts(project_id);
CREATE INDEX idx_content_concepts_type ON content_concepts(concept_type);
CREATE INDEX idx_content_concepts_status ON content_concepts(status);

-- ============================================
-- 3. SCRIPTS (voix-off par concept)
-- ============================================
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID NOT NULL REFERENCES content_concepts(id) ON DELETE CASCADE,
  voiceover_text TEXT NOT NULL,
  voice_gender TEXT CHECK (voice_gender IN ('male', 'female')),
  voice_accent TEXT DEFAULT 'français',
  voice_speed REAL DEFAULT 1.0,
  estimated_duration_seconds REAL,
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'generated', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scripts_concept ON scripts(concept_id);

-- ============================================
-- 4. MEDIA ASSETS (images, vidéos, audio)
-- ============================================
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES content_concepts(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video', 'audio', 'subtitle', 'music')),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  provider TEXT,
  model TEXT,
  prompt TEXT,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'generated', 'failed', 'approved', 'rejected')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_assets_project ON media_assets(project_id);
CREATE INDEX idx_media_assets_concept ON media_assets(concept_id);
CREATE INDEX idx_media_assets_type ON media_assets(asset_type);
CREATE INDEX idx_media_assets_status ON media_assets(status);

-- ============================================
-- 5. GENERATION JOBS (jobs asynchrones)
-- ============================================
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('text', 'image', 'voice', 'music', 'video', 'subtitle', 'assembly', 'qa')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'concept', 'script', 'media_asset')),
  entity_id UUID NOT NULL,
  provider TEXT,
  model TEXT,
  priority TEXT DEFAULT 'standard' CHECK (priority IN ('cheap', 'standard', 'premium')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  idempotency_key TEXT UNIQUE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_type ON generation_jobs(job_type);
CREATE INDEX idx_generation_jobs_entity ON generation_jobs(entity_type, entity_id);
CREATE INDEX idx_generation_jobs_idempotency ON generation_jobs(idempotency_key);

-- ============================================
-- 6. CONTENT QUEUE (file de publication)
-- ============================================
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES content_concepts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'youtube')),
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  caption TEXT,
  hashtags TEXT[],
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_queue_status ON content_queue(status);
CREATE INDEX idx_content_queue_platform ON content_queue(platform);
CREATE INDEX idx_content_queue_scheduled ON content_queue(scheduled_at);

-- ============================================
-- 7. PLATFORM ACCOUNTS (comptes OAuth)
-- ============================================
CREATE TABLE IF NOT EXISTS platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'youtube')),
  account_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_accounts_platform ON platform_accounts(platform);

-- ============================================
-- 8. AI PROVIDERS (config fournisseurs)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('text', 'image', 'voice', 'music', 'video')),
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('cheap', 'standard', 'premium')),
  is_active BOOLEAN DEFAULT true,
  config JSONB,
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 1000,
  cost_per_unit REAL DEFAULT 0,
  unit_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 9. USAGE RECORDS (tracking coûts)
-- ============================================
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL,
  units_used INTEGER DEFAULT 1,
  cost REAL DEFAULT 0,
  metadata JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_records_provider ON usage_records(provider);
CREATE INDEX idx_usage_records_date ON usage_records(recorded_at);

-- ============================================
-- 10. SYSTEM SETTINGS (config globale)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'brand', 'posting', 'budget', 'autopilot')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category, key)
);

-- ============================================
-- 11. PUBLISHING HISTORY (historique)
-- ============================================
CREATE TABLE IF NOT EXISTS publishing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES content_queue(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  platform_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_publishing_history_platform ON publishing_history(platform);
CREATE INDEX idx_publishing_history_date ON publishing_history(created_at);

-- ============================================
-- RLS Policies (enable per role)
-- ============================================
ALTER TABLE content_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_history ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY admin_all_content_projects ON content_projects FOR ALL USING (is_admin());
CREATE POLICY admin_all_content_concepts ON content_concepts FOR ALL USING (is_admin());
CREATE POLICY admin_all_scripts ON scripts FOR ALL USING (is_admin());
CREATE POLICY admin_all_media_assets ON media_assets FOR ALL USING (is_admin());
CREATE POLICY admin_all_generation_jobs ON generation_jobs FOR ALL USING (is_admin());
CREATE POLICY admin_all_content_queue ON content_queue FOR ALL USING (is_admin());
CREATE POLICY admin_all_platform_accounts ON platform_accounts FOR ALL USING (is_admin());
CREATE POLICY admin_all_ai_providers ON ai_providers FOR ALL USING (is_admin());
CREATE POLICY admin_all_usage_records ON usage_records FOR ALL USING (is_admin());
CREATE POLICY admin_all_system_settings ON system_settings FOR ALL USING (is_admin());
CREATE POLICY admin_all_publishing_history ON publishing_history FOR ALL USING (is_admin());

-- Service role can do everything (for backend jobs)
CREATE POLICY service_all_content_projects ON content_projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_content_concepts ON content_concepts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_scripts ON scripts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_media_assets ON media_assets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_generation_jobs ON generation_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_content_queue ON content_queue FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_platform_accounts ON platform_accounts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_ai_providers ON ai_providers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_usage_records ON usage_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_system_settings ON system_settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_all_publishing_history ON publishing_history FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Seed default brand settings
-- ============================================
INSERT INTO system_settings (category, key, value, description) VALUES
('brand', 'brand_name', '"Atémi"', 'Nom de la marque'),
('brand', 'primary_color', '"#C5A880"', 'Couleur principale'),
('brand', 'secondary_color', '"#1A1919"', 'Couleur secondaire'),
('brand', 'accent_color', '"#D4A0A0"', 'Couleur accent'),
('brand', 'default_language', '"fr"', 'Langue par défaut'),
('brand', 'default_cta', '"Commandez maintenant"', 'CTA par défaut'),
('posting', 'posts_per_day', '3', 'Nombre de publications par jour'),
('posting', 'posting_times', '["08:00","14:00","20:00"]', 'Horaires de publication'),
('posting', 'active_platforms', '["tiktok","instagram","facebook"]', 'Plateformes actives'),
('budget', 'max_daily_cost', '5.00', 'Budget max journalier en USD'),
('budget', 'max_monthly_cost', '50.00', 'Budget max mensuel en USD'),
('autopilot', 'enabled', 'false', 'Mode autopilot activé'),
('autopilot', 'auto_publish', 'false', 'Publication automatique'),
('autopilot', 'require_approval', 'true', 'Validation requise avant publication')
ON CONFLICT (category, key) DO NOTHING;
