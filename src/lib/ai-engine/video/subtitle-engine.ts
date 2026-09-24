/**
 * ATEMI AI CONTENT ENGINE — Subtitle Engine
 *
 * Generates subtitles for videos in SRT, VTT, and ASS formats.
 * Validates synchronization and readability.
 */

// ============================================
// Types
// ============================================

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

export interface SubtitleEntry {
  index: number;
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
}

export interface SubtitleConfig {
  format: SubtitleFormat;
  maxCharsPerLine?: number;
  maxLines?: number;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  position?: 'bottom' | 'top';
}

export interface GeneratedSubtitle {
  content: string;
  format: SubtitleFormat;
  entryCount: number;
  durationSeconds: number;
}

// ============================================
// Subtitle Generation
// ============================================

/**
 * Generate subtitles from script segments
 */
export function generateSubtitles(
  segments: Array<{ text: string; durationSeconds: number }>,
  config: SubtitleConfig
): GeneratedSubtitle {
  const entries: SubtitleEntry[] = [];
  let currentTime = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const words = segment.text.split(' ');
    const maxChars = config.maxCharsPerLine || 40;

    // Split long text into multiple subtitle entries
    let currentLine = '';
    const lines: string[] = [];

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length > maxChars) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = (currentLine + ' ' + word).trim();
      }
    }
    if (currentLine) lines.push(currentLine.trim());

    // Create entries for each line
    const timePerLine = segment.durationSeconds / Math.max(lines.length, 1);

    for (const line of lines) {
      entries.push({
        index: entries.length + 1,
        startTime: currentTime,
        endTime: currentTime + timePerLine,
        text: line,
      });
      currentTime += timePerLine;
    }
  }

  // Format based on config
  const content = formatSubtitles(entries, config);

  return {
    content,
    format: config.format,
    entryCount: entries.length,
    durationSeconds: currentTime,
  };
}

/**
 * Format subtitles to specific format
 */
function formatSubtitles(entries: SubtitleEntry[], config: SubtitleConfig): string {
  switch (config.format) {
    case 'srt':
      return formatSRT(entries);
    case 'vtt':
      return formatVTT(entries);
    case 'ass':
      return formatASS(entries, config);
    default:
      return formatSRT(entries);
  }
}

/**
 * Format as SRT
 */
function formatSRT(entries: SubtitleEntry[]): string {
  return entries
    .map((entry) => {
      const start = formatTimeSRT(entry.startTime);
      const end = formatTimeSRT(entry.endTime);
      return `${entry.index}\n${start} --> ${end}\n${entry.text}\n`;
    })
    .join('\n');
}

/**
 * Format as VTT
 */
function formatVTT(entries: SubtitleEntry[]): string {
  const header = 'WEBVTT\n\n';
  const body = entries
    .map((entry) => {
      const start = formatTimeVTT(entry.startTime);
      const end = formatTimeVTT(entry.endTime);
      return `${start} --> ${end}\n${entry.text}\n`;
    })
    .join('\n');
  return header + body;
}

/**
 * Format as ASS
 */
function formatASS(entries: SubtitleEntry[], config: SubtitleConfig): string {
  const fontSize = config.fontSize || 24;
  const fontColor = config.fontColor || '&H00FFFFFF';
  const position = config.position === 'top' ? 8 : 2;

  const header = `[Script Info]
Title: ATEMI Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},${fontColor},&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,${position},10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const body = entries
    .map((entry) => {
      const start = formatTimeASS(entry.startTime);
      const end = formatTimeASS(entry.endTime);
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${entry.text}`;
    })
    .join('\n');

  return header + body;
}

/**
 * Format time for SRT (HH:MM:SS,mmm)
 */
function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format time for VTT (HH:MM:SS.mmm)
 */
function formatTimeVTT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Format time for ASS (H:MM:SS.cc)
 */
function formatTimeASS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Validate subtitle quality
 */
export function validateSubtitles(subtitles: GeneratedSubtitle): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for empty entries
  if (subtitles.entryCount === 0) {
    issues.push('No subtitle entries');
  }

  // Check duration
  if (subtitles.durationSeconds <= 0) {
    issues.push('Invalid duration');
  }

  // Check format
  if (!['srt', 'vtt', 'ass'].includes(subtitles.format)) {
    issues.push('Invalid subtitle format');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
