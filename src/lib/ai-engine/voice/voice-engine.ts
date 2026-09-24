/**
 * ATEMI AI CONTENT ENGINE — Voice Engine
 *
 * Generates voiceovers for video content.
 * Abstraction over voice providers (ElevenLabs, etc.)
 */

import { getAIRouter } from '../router/ai-router';
import { recordUsage } from '../cost/cost-tracker';
import { uploadAsset } from '../storage/storage-manager';

// ============================================
// Types
// ============================================

export type VoiceGender = 'male' | 'female';
export type VoiceEmotion = 'neutral' | 'happy' | 'excited' | 'warm' | 'serious';

export interface VoiceConfig {
  gender: VoiceGender;
  accent?: string;
  speed?: number;
  pitch?: number;
  emotion?: VoiceEmotion;
}

export interface VoiceGenerationParams {
  productId: string;
  text: string;
  voice: VoiceConfig;
  outputFormat?: 'mp3' | 'wav';
}

export interface GeneratedVoice {
  audioUrl: string;
  path: string;
  durationSeconds: number;
  characterCount: number;
}

// ============================================
// Voice Provider Configurations
// ============================================

// ElevenLabs voice IDs (French voices)
const VOICE_MAP: Record<string, string> = {
  'female_warm': 'EXAVITQu4vr4xnSDxMaL', // Bella
  'female_excited': 'TX3LPaxmHKxFdv7VOQHJ', // Rachel
  'female_serious': 'nPczCjzI2devNBz1zQrb', // Elli
  'male_warm': 'TX3LPaxmHKxFdv7VOQHJ', // Adam
  'male_serious': 'nPczCjzI2devNBz1zQrb', // Josh
};

/**
 * Get voice ID from config
 */
function getVoiceId(config: VoiceConfig): string {
  const key = `${config.gender}_${config.emotion || 'warm'}`;
  return VOICE_MAP[key] || VOICE_MAP['female_warm'];
}

// ============================================
// Voice Generation
// ============================================

/**
 * Generate a voiceover
 */
export async function generateVoiceover(
  params: VoiceGenerationParams
): Promise<GeneratedVoice> {
  const router = getAIRouter();
  const { productId, text, voice, outputFormat = 'mp3' } = params;

  const voiceId = getVoiceId(voice);

  const result = await router.generateVoice(
    {
      text,
      voiceId,
      gender: voice.gender,
      accent: voice.accent || 'français',
      speed: voice.speed || 1.0,
      emotion: voice.emotion || 'warm',
      outputFormat,
    },
    'standard'
  );

  if (!result.success || !result.data) {
    throw new Error(`Voice generation failed: ${result.error}`);
  }

  // Upload to storage
  const uploadResult = await uploadAsset(
    productId,
    'audio',
    `voiceover_${Date.now()}.${outputFormat}`,
    result.data.audioBuffer,
    `audio/${outputFormat}`
  );

  await recordUsage({
    provider: result.provider,
    operationType: 'voice_generation',
    units: result.data.characterCount,
    cost: result.cost,
    metadata: { productId, voiceId, characterCount: result.data.characterCount },
  });

  return {
    audioUrl: uploadResult.url,
    path: uploadResult.path,
    durationSeconds: result.data.durationSeconds,
    characterCount: result.data.characterCount,
  };
}

/**
 * Generate voiceovers for multiple scripts
 */
export async function generateMultipleVoiceovers(
  productId: string,
  scripts: Array<{ text: string; voice: VoiceConfig }>
): Promise<GeneratedVoice[]> {
  const results: GeneratedVoice[] = [];

  for (const script of scripts) {
    try {
      const voice = await generateVoiceover({
        productId,
        text: script.text,
        voice: script.voice,
      });
      results.push(voice);
    } catch (error) {
      console.error('Voice generation failed:', error);
    }
  }

  return results;
}

/**
 * List available voices
 */
export async function listAvailableVoices(): Promise<Array<{
  id: string;
  name: string;
  gender: VoiceGender;
  accent: string;
}>> {
  return [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', accent: 'français' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Rachel', gender: 'female', accent: 'français' },
    { id: 'nPczCjzI2devNBz1zQrb', name: 'Elli', gender: 'female', accent: 'français' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Adam', gender: 'male', accent: 'français' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Josh', gender: 'male', accent: 'français' },
  ];
}
