/**
 * ATEMI AI CONTENT ENGINE — Video Assembler
 *
 * Assembles video components using FFmpeg.
 * Combines images, voice, music, subtitles, and branding.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { VideoComposition, VideoFormat } from './video-engine';
import { uploadAsset } from '../storage/storage-manager';

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

export interface AssemblyInput {
  productId: string;
  composition: VideoComposition;
  images: string[];
  voiceoverPath?: string;
  musicPath?: string;
  subtitleContent?: string;
  branding?: {
    logoPath?: string;
    watermark?: boolean;
    ctaText?: string;
    primaryColor?: string;
  };
}

export interface AssemblyResult {
  videoUrl: string;
  path: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

// ============================================
// FFmpeg Assembly
// ============================================

/**
 * Assemble a video from components using FFmpeg
 */
export async function assembleVideo(input: AssemblyInput): Promise<AssemblyResult> {
  const {
    productId,
    composition,
    images,
    voiceoverPath,
    musicPath,
    subtitleContent,
    branding,
  } = input;

  const tmpDir = tmpdir();
  const outputFilename = `video_${Date.now()}.mp4`;
  const outputPath = join(tmpDir, outputFilename);
  const filterPath = join(tmpDir, `filter_${Date.now()}.txt`);

  try {
    // Build FFmpeg filter complex
    const filterComplex = buildFilterComplex(composition, images, branding, voiceoverPath, musicPath);

    // Build FFmpeg command
    const args: string[] = [];

    // Input images
    for (const img of images) {
      args.push(`-loop 1 -t ${composition.durationSeconds / images.length} -i "${img}"`);
    }

    // Voiceover input
    if (voiceoverPath) {
      args.push(`-i "${voiceoverPath}"`);
    }

    // Music input
    if (musicPath) {
      args.push(`-i "${musicPath}"`);
    }

    // Filter complex
    args.push(`-filter_complex "${filterComplex}"`);

    // Output settings
    args.push(`-c:v libx264 -preset medium -crf 23`);
    args.push(`-pix_fmt yuv420p`);
    args.push(`-c:a aac -b:a 128k`);
    args.push(`-shortest`);
    args.push(`-y "${outputPath}"`);

    // Execute FFmpeg
    await execAsync(`ffmpeg ${args.join(' ')}`);

    // Read output file
    const videoBuffer = await readFile(outputPath);

    // Upload to storage
    const uploadResult = await uploadAsset(
      productId,
      'video',
      outputFilename,
      videoBuffer,
      'video/mp4'
    );

    return {
      videoUrl: uploadResult.url,
      path: uploadResult.path,
      durationSeconds: composition.durationSeconds,
      fileSizeBytes: videoBuffer.length,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Assembly failed';
    throw new Error(`Video assembly failed: ${errMsg}`);
  } finally {
    // Cleanup temp files
    try {
      await unlink(outputPath);
      await unlink(filterPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Build FFmpeg filter complex
 */
function buildFilterComplex(
  composition: VideoComposition,
  images: string[],
  branding?: { logoPath?: string; watermark?: boolean; primaryColor?: string; ctaText?: string },
  voiceoverPath?: string,
  musicPath?: string
): string {
  const { width, height } = getDimensions(composition.format);
  const filters: string[] = [];

  // Scale and concatenate images
  for (let i = 0; i < images.length; i++) {
    filters.push(`[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`);
  }

  // Concatenate video streams
  const concatInputs = images.map((_, i) => `[v${i}]`).join('');
  filters.push(`${concatInputs}concat=n=${images.length}:v=1:a=0[vconcat]`);

  // Add watermark if enabled
  if (branding?.watermark && branding.primaryColor) {
    filters.push(`[vconcat]drawtext=text='ATEMI':fontsize=24:fontcolor=${branding.primaryColor}:x=10:y=10[vwatermark]`);
  }

  // Add CTA text overlay
  if ((branding as { ctaText?: string })?.ctaText) {
    const finalStream = branding?.watermark ? '[vwatermark]' : '[vconcat]';
    filters.push(`${finalStream}drawtext=text='${(branding as { ctaText: string }).ctaText}':fontsize=32:fontcolor=white:x=(w-tw)/2:y=h-th-50[vcta]`);
  }

  // Audio mixing
  const audioInputs: string[] = [];

  if (voiceoverPath && musicPath) {
    audioInputs.push(`[${images.length}:a]`);
    audioInputs.push(`[${images.length + 1}:a]`);
    // Mix voice and music, lower music volume
    filters.push(`[${images.length}:a]volume=1.0[voice]`);
    filters.push(`[${images.length + 1}:a]volume=0.2[music]`);
    filters.push(`[voice][music]amix=inputs=2:duration=first[aout]`);
  } else if (voiceoverPath) {
    filters.push(`[${images.length}:a]volume=1.0[aout]`);
  } else if (musicPath) {
    filters.push(`[${images.length}:a]volume=0.3[aout]`);
  }

  return filters.join(';');
}

/**
 * Get dimensions for format
 */
function getDimensions(format: VideoFormat): { width: number; height: number } {
  switch (format) {
    case '9:16': return { width: 1080, height: 1920 };
    case '1:1': return { width: 1080, height: 1080 };
    case '16:9': return { width: 1920, height: 1080 };
    default: return { width: 1080, height: 1920 };
  }
}
