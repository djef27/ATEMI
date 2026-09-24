/**
 * ATEMI AI CONTENT ENGINE — AI Router
 *
 * Routes AI requests to the best provider based on:
 * - Task type (text, image, voice, music, video)
 * - Quality tier (cheap, standard, premium)
 * - Cost optimization
 * - Provider availability
 * - Rate limits
 */

import type {
  ProviderTier,
  ProviderType,
  TextProvider,
  TextGenerationRequest,
  TextGenerationResult,
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  VoiceProvider,
  VoiceGenerationRequest,
  VoiceGenerationResult,
  MusicProvider,
  MusicGenerationRequest,
  MusicGenerationResult,
  VideoProvider,
  VideoGenerationRequest,
  VideoGenerationResult,
  GenerationResult,
  RateLimitConfig,
} from '../providers/base';

// ============================================
// Provider Registry
// ============================================

interface RegisteredProvider {
  name: string;
  type: ProviderType;
  tier: ProviderTier;
  provider: TextProvider | ImageProvider | VoiceProvider | MusicProvider | VideoProvider;
  rateLimit: RateLimitConfig;
  costPerUnit: number;
  isActive: boolean;
  lastError?: string;
  lastErrorAt?: Date;
}

// ============================================
// AI Router Class
// ============================================

class AIRouter {
  private providers: Map<string, RegisteredProvider> = new Map();
  private usageCounts: Map<string, { minute: number; day: number; lastMinute: Date; lastDay: Date }> = new Map();

  /**
   * Register a provider
   */
  registerProvider(config: {
    name: string;
    type: ProviderType;
    tier: ProviderTier;
    provider: TextProvider | ImageProvider | VoiceProvider | MusicProvider | VideoProvider;
    rateLimit?: RateLimitConfig;
    costPerUnit?: number;
  }): void {
    const key = `${config.type}:${config.tier}:${config.name}`;
    this.providers.set(key, {
      name: config.name,
      type: config.type,
      tier: config.tier,
      provider: config.provider,
      rateLimit: config.rateLimit || { requestsPerMinute: 60, requestsPerDay: 1000 },
      costPerUnit: config.costPerUnit || 0,
      isActive: true,
    });
  }

  /**
   * Get the best provider for a task
   */
  private getBestProvider<T extends { model?: string }>(
    type: ProviderType,
    tier: ProviderTier,
    request: T
  ): RegisteredProvider | null {
    const candidates = Array.from(this.providers.values()).filter(
      (p) => p.type === type && p.tier === tier && p.isActive
    );

    if (candidates.length === 0) {
      // Fallback: try any tier for this type
      const fallback = Array.from(this.providers.values()).filter(
        (p) => p.type === type && p.isActive
      );
      if (fallback.length === 0) return null;
      // Sort by cost (cheapest first)
      fallback.sort((a, b) => a.costPerUnit - b.costPerUnit);
      return fallback[0];
    }

    // Check rate limits
    const available = candidates.filter((p) => !this.isRateLimited(p));
    if (available.length === 0) {
      // Try fallback tiers
      const tierOrder: ProviderTier[] = ['cheap', 'standard', 'premium'];
      const fallbackTier = tierOrder.find((t) => t !== tier);
      if (fallbackTier) {
        const fallback = candidates.filter((p) => p.tier === fallbackTier && !this.isRateLimited(p));
        if (fallback.length > 0) return fallback[0];
      }
      return null;
    }

    // Sort by cost (cheapest first)
    available.sort((a, b) => a.costPerUnit - b.costPerUnit);
    return available[0];
  }

  /**
   * Check if a provider is rate limited
   */
  private isRateLimited(provider: RegisteredProvider): boolean {
    const key = `${provider.type}:${provider.tier}:${provider.name}`;
    const usage = this.usageCounts.get(key);
    if (!usage) return false;

    const now = new Date();

    // Check per-minute limit
    if (now.getTime() - usage.lastMinute.getTime() > 60_000) {
      usage.minute = 0;
      usage.lastMinute = now;
    }
    if (usage.minute >= provider.rateLimit.requestsPerMinute) return true;

    // Check per-day limit
    if (now.getTime() - usage.lastDay.getTime() > 86_400_000) {
      usage.day = 0;
      usage.lastDay = now;
    }
    if (usage.day >= provider.rateLimit.requestsPerDay) return true;

    return false;
  }

  /**
   * Increment usage count
   */
  private incrementUsage(provider: RegisteredProvider): void {
    const key = `${provider.type}:${provider.tier}:${provider.name}`;
    const usage = this.usageCounts.get(key) || { minute: 0, day: 0, lastMinute: new Date(), lastDay: new Date() };
    usage.minute++;
    usage.day++;
    this.usageCounts.set(key, usage);
  }

  /**
   * Mark provider as errored
   */
  private markError(provider: RegisteredProvider, error: string): void {
    provider.lastError = error;
    provider.lastErrorAt = new Date();
    // Disable provider temporarily if repeated errors
    // (simple heuristic: disable for 5 minutes after 3 consecutive errors)
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Generate text
   */
  async generateText(
    request: TextGenerationRequest,
    tier: ProviderTier = 'standard'
  ): Promise<GenerationResult<TextGenerationResult>> {
    const provider = this.getBestProvider<TextGenerationRequest>('text', tier, request);
    if (!provider) {
      return {
        success: false,
        error: 'No text provider available',
        provider: 'none',
        model: 'none',
        cost: 0,
        units: 0,
        durationMs: 0,
      };
    }

    const textProvider = provider.provider as TextProvider;
    const start = Date.now();

    try {
      this.incrementUsage(provider);
      const result = await textProvider.generate(request);
      return {
        ...result,
        provider: provider.name,
        model: request.model || 'default',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.markError(provider, errorMsg);
      return {
        success: false,
        error: errorMsg,
        provider: provider.name,
        model: request.model || 'default',
        cost: 0,
        units: 0,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Generate image
   */
  async generateImage(
    request: ImageGenerationRequest,
    tier: ProviderTier = 'standard'
  ): Promise<GenerationResult<ImageGenerationResult>> {
    const provider = this.getBestProvider<ImageGenerationRequest>('image', tier, request);
    if (!provider) {
      return {
        success: false,
        error: 'No image provider available',
        provider: 'none',
        model: 'none',
        cost: 0,
        units: 0,
        durationMs: 0,
      };
    }

    const imageProvider = provider.provider as ImageProvider;
    const start = Date.now();

    try {
      this.incrementUsage(provider);
      const result = await imageProvider.generate(request);
      return {
        ...result,
        provider: provider.name,
        model: request.model || 'default',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.markError(provider, errorMsg);
      return {
        success: false,
        error: errorMsg,
        provider: provider.name,
        model: request.model || 'default',
        cost: 0,
        units: 0,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Generate voice
   */
  async generateVoice(
    request: VoiceGenerationRequest,
    tier: ProviderTier = 'standard'
  ): Promise<GenerationResult<VoiceGenerationResult>> {
    const provider = this.getBestProvider<VoiceGenerationRequest>('voice', tier, request);
    if (!provider) {
      return {
        success: false,
        error: 'No voice provider available',
        provider: 'none',
        model: 'none',
        cost: 0,
        units: 0,
        durationMs: 0,
      };
    }

    const voiceProvider = provider.provider as VoiceProvider;
    const start = Date.now();

    try {
      this.incrementUsage(provider);
      const result = await voiceProvider.generate(request);
      return {
        ...result,
        provider: provider.name,
        model: request.model || 'default',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.markError(provider, errorMsg);
      return {
        success: false,
        error: errorMsg,
        provider: provider.name,
        model: request.model || 'default',
        cost: 0,
        units: 0,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Generate music
   */
  async generateMusic(
    request: MusicGenerationRequest,
    tier: ProviderTier = 'standard'
  ): Promise<GenerationResult<MusicGenerationResult>> {
    const provider = this.getBestProvider<MusicGenerationRequest>('music', tier, request);
    if (!provider) {
      return {
        success: false,
        error: 'No music provider available',
        provider: 'none',
        model: 'none',
        cost: 0,
        units: 0,
        durationMs: 0,
      };
    }

    const musicProvider = provider.provider as MusicProvider;
    const start = Date.now();

    try {
      this.incrementUsage(provider);
      const result = await musicProvider.generate(request);
      return {
        ...result,
        provider: provider.name,
        model: request.model || 'default',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.markError(provider, errorMsg);
      return {
        success: false,
        error: errorMsg,
        provider: provider.name,
        model: request.model || 'default',
        cost: 0,
        units: 0,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Generate video
   */
  async generateVideo(
    request: VideoGenerationRequest,
    tier: ProviderTier = 'standard'
  ): Promise<GenerationResult<VideoGenerationResult>> {
    const provider = this.getBestProvider<VideoGenerationRequest>('video', tier, request);
    if (!provider) {
      return {
        success: false,
        error: 'No video provider available',
        provider: 'none',
        model: 'none',
        cost: 0,
        units: 0,
        durationMs: 0,
      };
    }

    const videoProvider = provider.provider as VideoProvider;
    const start = Date.now();

    try {
      this.incrementUsage(provider);
      const result = await videoProvider.generate(request);
      return {
        ...result,
        provider: provider.name,
        model: request.model || 'default',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.markError(provider, errorMsg);
      return {
        success: false,
        error: errorMsg,
        provider: provider.name,
        model: request.model || 'default',
        cost: 0,
        units: 0,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Array<{
    name: string;
    type: ProviderType;
    tier: ProviderTier;
    isActive: boolean;
    lastError?: string;
    lastErrorAt?: Date;
  }> {
    return Array.from(this.providers.values()).map((p) => ({
      name: p.name,
      type: p.type,
      tier: p.tier,
      isActive: p.isActive,
      lastError: p.lastError,
      lastErrorAt: p.lastErrorAt,
    }));
  }

  /**
   * Get usage stats
   */
  getUsageStats(): Array<{
    provider: string;
    minute: number;
    day: number;
  }> {
    return Array.from(this.usageCounts.entries()).map(([key, usage]) => ({
      provider: key,
      minute: usage.minute,
      day: usage.day,
    }));
  }
}

// Singleton instance
let routerInstance: AIRouter | null = null;

export function getAIRouter(): AIRouter {
  if (!routerInstance) {
    routerInstance = new AIRouter();
  }
  return routerInstance;
}

export { AIRouter };
export type { RegisteredProvider };
