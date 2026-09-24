/**
 * ATEMI AI CONTENT ENGINE — Base Provider Interfaces
 *
 * Abstract interfaces for all AI providers.
 * Each provider implementation must implement these interfaces.
 *
 * SECURITY: API keys are NEVER stored in this file.
 * They are loaded from environment variables at runtime.
 */

// ============================================
// Common Types
// ============================================

export type ProviderTier = 'cheap' | 'standard' | 'premium';
export type ProviderType = 'text' | 'image' | 'voice' | 'music' | 'video';

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  tier: ProviderTier;
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface GenerationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  provider: string;
  model: string;
  cost: number;
  units: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
}

// ============================================
// Text Provider
// ============================================

export interface TextGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  model?: string;
}

export interface TextGenerationResult {
  text: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: string;
}

export interface TextProvider {
  generate(request: TextGenerationRequest): Promise<GenerationResult<TextGenerationResult>>;
  countTokens(text: string): Promise<number>;
}

// ============================================
// Image Provider
// ============================================

export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
export type ImageQuality = 'standard' | 'hd';
export type ImageStyle = 'vivid' | 'natural';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number;
  model?: string;
}

export interface ImageGenerationResult {
  images: Array<{
    url: string;
    revisedPrompt?: string;
    base64?: string;
  }>;
}

export interface ImageProvider {
  generate(request: ImageGenerationRequest): Promise<GenerationResult<ImageGenerationResult>>;
}

// ============================================
// Voice Provider
// ============================================

export type VoiceGender = 'male' | 'female';
export type VoiceEmotion = 'neutral' | 'happy' | 'sad' | 'excited' | 'serious' | 'warm';

export interface VoiceGenerationRequest {
  text: string;
  voiceId: string;
  gender?: VoiceGender;
  accent?: string;
  speed?: number;
  pitch?: number;
  emotion?: VoiceEmotion;
  outputFormat?: 'mp3' | 'wav' | 'ogg';
  model?: string;
}

export interface VoiceGenerationResult {
  audioUrl: string;
  audioBuffer: Buffer;
  durationSeconds: number;
  characterCount: number;
}

export interface VoiceProvider {
  generate(request: VoiceGenerationRequest): Promise<GenerationResult<VoiceGenerationResult>>;
  listVoices(): Promise<Array<{
    id: string;
    name: string;
    gender: VoiceGender;
    accent: string;
    previewUrl?: string;
  }>>;
}

// ============================================
// Music Provider
// ============================================

export type MusicMood = 'upbeat' | 'calm' | 'dramatic' | 'romantic' | 'energetic' | 'mysterious' | 'happy' | 'sad';

export interface MusicGenerationRequest {
  prompt?: string;
  mood?: MusicMood;
  durationSeconds?: number;
  bpm?: number;
  key?: string;
  genre?: string;
  instrumentalOnly?: boolean;
  model?: string;
}

export interface MusicGenerationResult {
  audioUrl: string;
  audioBuffer: Buffer;
  durationSeconds: number;
  licenseStatus: 'verified' | 'unverified' | 'royalty_free';
}

export interface MusicProvider {
  generate(request: MusicGenerationRequest): Promise<GenerationResult<MusicGenerationResult>>;
  searchLibrary(query: string): Promise<Array<{
    id: string;
    title: string;
    mood: MusicMood;
    durationSeconds: number;
    previewUrl: string;
    licenseStatus: string;
  }>>;
}

// ============================================
// Video Provider
// ============================================

export type VideoFormat = '9:16' | '1:1' | '16:9';
export type VideoDuration = 10 | 15 | 20 | 30;

export interface VideoGenerationRequest {
  prompt: string;
  imageUrl?: string;
  duration?: VideoDuration;
  format?: VideoFormat;
  fps?: number;
  model?: string;
}

export interface VideoGenerationResult {
  videoUrl: string;
  durationSeconds: number;
  width: number;
  height: number;
}

export interface VideoProvider {
  generate(request: VideoGenerationRequest): Promise<GenerationResult<VideoGenerationResult>>;
}
