/**
 * ATEMI AI CONTENT ENGINE — Video Engine
 *
 * Orchestrates video generation using AI and assembly.
 * Generates clips, manages composition, and produces final videos.
 */

import { getAIRouter } from '../router/ai-router';
import { recordUsage } from '../cost/cost-tracker';
import { uploadAsset } from '../storage/storage-manager';
import { generateSubtitles, type SubtitleConfig } from './subtitle-engine';
import type { ProductTruth } from '../text/product-truth';

// ============================================
// Types
// ============================================

export type VideoFormat = '9:16' | '1:1' | '16:9';
export type VideoDuration = 10 | 15 | 20 | 30;

export interface VideoScene {
  type: 'hook' | 'product' | 'benefit' | 'cta' | 'transition';
  startTime: number;
  endTime: number;
  text?: string;
  imageUrl?: string;
  transition?: 'cut' | 'fade' | 'slide' | 'zoom';
}

export interface VideoComposition {
  scenes: VideoScene[];
  voiceoverPath?: string;
  musicPath?: string;
  subtitleContent?: string;
  format: VideoFormat;
  durationSeconds: number;
}

export interface VideoConfig {
  productId: string;
  format: VideoFormat;
  duration: VideoDuration;
  scenes: VideoScene[];
  voiceoverText?: string;
  images?: string[];
}

export interface GeneratedVideo {
  videoUrl: string;
  path: string;
  durationSeconds: number;
  format: VideoFormat;
  width: number;
  height: number;
}

// ============================================
// Video Generation
// ============================================

/**
 * Generate a video using AI
 */
export async function generateVideoClip(
  productId: string,
  prompt: string,
  format: VideoFormat = '9:16',
  duration: VideoDuration = 15
): Promise<GeneratedVideo> {
  const router = getAIRouter();

  const result = await router.generateVideo(
    {
      prompt,
      duration,
      format,
      fps: 30,
    },
    'standard'
  );

  if (!result.success || !result.data) {
    throw new Error(`Video generation failed: ${result.error}`);
  }

  // Upload to storage
  const uploadResult = await uploadAsset(
    productId,
    'video',
    `clip_${Date.now()}.mp4`,
    Buffer.from(''), // Would be actual video buffer
    'video/mp4'
  );

  await recordUsage({
    provider: result.provider,
    operationType: 'video_generation',
    units: 1,
    cost: result.cost,
    metadata: { productId, format, duration },
  });

  return {
    videoUrl: result.data.videoUrl || uploadResult.url,
    path: uploadResult.path,
    durationSeconds: result.data.durationSeconds,
    format,
    width: result.data.width,
    height: result.data.height,
  };
}

/**
 * Get dimensions for video format
 */
export function getVideoDimensions(format: VideoFormat): { width: number; height: number } {
  switch (format) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
    default:
      return { width: 1080, height: 1920 };
  }
}

/**
 * Create video composition from scenes
 */
export function createComposition(config: VideoConfig): VideoComposition {
  const scenes: VideoScene[] = [];
  let currentTime = 0;

  for (const scene of config.scenes) {
    scenes.push({
      ...scene,
      startTime: currentTime,
      endTime: currentTime + (scene.endTime - scene.startTime),
    });
    currentTime = scene.endTime;
  }

  return {
    scenes,
    format: config.format,
    durationSeconds: config.duration,
  };
}

/**
 * Generate subtitles for a video
 */
export function generateVideoSubtitles(
  script: string,
  durationSeconds: number
): string {
  const words = script.split(' ');
  const wordsPerScene = Math.ceil(words.length / 4); // Split into ~4 scenes

  const segments: Array<{ text: string; durationSeconds: number }> = [];

  for (let i = 0; i < words.length; i += wordsPerScene) {
    const sceneWords = words.slice(i, i + wordsPerScene);
    segments.push({
      text: sceneWords.join(' '),
      durationSeconds: durationSeconds / 4,
    });
  }

  const config: SubtitleConfig = {
    format: 'srt',
    maxCharsPerLine: 35,
    fontSize: 28,
    fontColor: '&H00FFFFFF',
    position: 'bottom',
  };

  const subtitles = generateSubtitles(segments, config);
  return subtitles.content;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
