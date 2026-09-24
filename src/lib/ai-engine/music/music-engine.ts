/**
 * ATEMI AI CONTENT ENGINE — Music Engine
 *
 * Generates or selects background music for videos.
 * Uses royalty-free music library + AI generation.
 */

import { getAIRouter } from '../router/ai-router';
import { recordUsage } from '../cost/cost-tracker';
import { uploadAsset } from '../storage/storage-manager';

// ============================================
// Types
// ============================================

export type MusicMood = 'upbeat' | 'calm' | 'dramatic' | 'romantic' | 'energetic' | 'mysterious' | 'happy' | 'sad';

export interface MusicConfig {
  mood: MusicMood;
  durationSeconds: number;
  bpm?: number;
  genre?: string;
  instrumentalOnly?: boolean;
}

export interface GeneratedMusic {
  audioUrl: string;
  path: string;
  durationSeconds: number;
  licenseStatus: 'verified' | 'unverified' | 'royalty_free';
}

// ============================================
// Music Library (Royalty-free tracks)
// ============================================

const ROYALTY_FREE_LIBRARY: Array<{
  id: string;
  title: string;
  mood: MusicMood;
  durationSeconds: number;
  bpm: number;
  genre: string;
  licenseStatus: 'verified' | 'royalty_free';
}> = [
  { id: 'track_001', title: 'African Vibes', mood: 'upbeat', durationSeconds: 30, bpm: 120, genre: 'afrobeat', licenseStatus: 'royalty_free' },
  { id: 'track_002', title: 'Sunset Glow', mood: 'calm', durationSeconds: 30, bpm: 90, genre: 'ambient', licenseStatus: 'royalty_free' },
  { id: 'track_003', title: 'Fashion Walk', mood: 'energetic', durationSeconds: 20, bpm: 128, genre: 'house', licenseStatus: 'royalty_free' },
  { id: 'track_004', title: 'Elegant', mood: 'dramatic', durationSeconds: 30, bpm: 100, genre: 'cinematic', licenseStatus: 'royalty_free' },
  { id: 'track_005', title: 'Joy', mood: 'happy', durationSeconds: 20, bpm: 115, genre: 'pop', licenseStatus: 'royalty_free' },
];

/**
 * Search music library
 */
export function searchMusicLibrary(query: string): typeof ROYALTY_FREE_LIBRARY {
  const lower = query.toLowerCase();
  return ROYALTY_FREE_LIBRARY.filter(
    (track) =>
      track.title.toLowerCase().includes(lower) ||
      track.mood.includes(lower) ||
      track.genre.includes(lower)
  );
}

/**
 * Get music by mood
 */
export function getMusicByMood(mood: MusicMood): typeof ROYALTY_FREE_LIBRARY {
  return ROYALTY_FREE_LIBRARY.filter((track) => track.mood === mood);
}

/**
 * Generate background music using AI
 */
export async function generateMusic(
  productId: string,
  config: MusicConfig
): Promise<GeneratedMusic> {
  // First try library
  const libraryTracks = getMusicByMood(config.mood);
  if (libraryTracks.length > 0) {
    const track = libraryTracks[0];
    return {
      audioUrl: '', // Would be actual file URL in production
      path: `library/${track.id}.mp3`,
      durationSeconds: track.durationSeconds,
      licenseStatus: track.licenseStatus,
    };
  }

  // Fallback to AI generation
  const router = getAIRouter();
  const result = await router.generateMusic(
    {
      mood: config.mood,
      durationSeconds: config.durationSeconds,
      bpm: config.bpm,
      genre: config.genre,
      instrumentalOnly: config.instrumentalOnly ?? true,
    },
    'standard'
  );

  if (!result.success || !result.data) {
    throw new Error(`Music generation failed: ${result.error}`);
  }

  // Upload to storage
  const uploadResult = await uploadAsset(
    productId,
    'audio',
    `music_${config.mood}_${Date.now()}.mp3`,
    result.data.audioBuffer,
    'audio/mpeg'
  );

  await recordUsage({
    provider: result.provider,
    operationType: 'music_generation',
    units: 1,
    cost: result.cost,
    metadata: { productId, mood: config.mood },
  });

  return {
    audioUrl: uploadResult.url,
    path: uploadResult.path,
    durationSeconds: result.data.durationSeconds,
    licenseStatus: result.data.licenseStatus,
  };
}

/**
 * Get recommended music for a content concept
 */
export function getRecommendedMusic(
  conceptType: string,
  durationSeconds: number
): MusicConfig {
  const moodMap: Record<string, MusicMood> = {
    ugc: 'upbeat',
    product_showcase: 'calm',
    lifestyle: 'happy',
    problem_solution: 'calm',
    before_after: 'dramatic',
    three_ways: 'energetic',
    product_details: 'calm',
    storytelling: 'romantic',
    promotional: 'upbeat',
    premium_commercial: 'dramatic',
  };

  return {
    mood: moodMap[conceptType] || 'upbeat',
    durationSeconds,
    instrumentalOnly: true,
  };
}
