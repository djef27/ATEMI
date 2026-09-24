/**
 * ATEMI AI CONTENT ENGINE — Storage Manager
 *
 * Manages file storage for generated content.
 * Uses Supabase Storage with organized paths.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';

export type AssetType = 'image' | 'video' | 'audio' | 'subtitle' | 'music';

export interface StorageUploadResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface StorageFileInfo {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

const BUCKET_NAME = 'content-engine';

/**
 * Get the storage path for a product asset
 */
function getAssetPath(
  productId: string,
  assetType: AssetType,
  filename: string
): string {
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${productId}/${assetType}/${timestamp}_${safeFilename}`;
}

/**
 * Ensure storage bucket exists
 */
async function ensureBucket(): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!bucketExists) {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'application/x-subrip',
        'text/vtt',
      ],
    });
  }
}

/**
 * Upload a file to storage
 */
export async function uploadAsset(
  productId: string,
  assetType: AssetType,
  filename: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<StorageUploadResult> {
  await ensureBucket();

  const path = getAssetPath(productId, assetType, filename);
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return {
    path,
    url: urlData.publicUrl,
    size: fileBuffer.length,
    mimeType,
  };
}

/**
 * Upload from URL (download and re-upload)
 */
export async function uploadAssetFromUrl(
  productId: string,
  assetType: AssetType,
  filename: string,
  sourceUrl: string,
  mimeType: string
): Promise<StorageUploadResult> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download from ${sourceUrl}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadAsset(productId, assetType, filename, buffer, mimeType);
}

/**
 * Get public URL for an asset
 */
export function getAssetUrl(path: string): string {
  const supabase = createAdminSupabaseClient();
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete an asset
 */
export async function deleteAsset(path: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * List all assets for a product
 */
export async function listProductAssets(
  productId: string,
  assetType?: AssetType
): Promise<StorageFileInfo[]> {
  const supabase = createAdminSupabaseClient();
  const path = assetType ? `${productId}/${assetType}` : productId;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(path, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error || !data) {
    return [];
  }

  return data.map((file) => ({
    path: `${path}/${file.name}`,
    name: file.name,
    size: file.metadata?.size || 0,
    mimeType: file.metadata?.mimetype || 'unknown',
    createdAt: file.created_at || new Date().toISOString(),
    updatedAt: file.updated_at || new Date().toISOString(),
  }));
}

/**
 * Get total storage usage for a product (in bytes)
 */
export async function getProductStorageUsage(productId: string): Promise<number> {
  const assets = await listProductAssets(productId);
  return assets.reduce((total, file) => total + file.size, 0);
}

/**
 * Clean up old assets for a product (keep last N of each type)
 */
export async function cleanupOldAssets(
  productId: string,
  keepPerType: number = 5
): Promise<number> {
  let deletedCount = 0;

  for (const assetType of ['image', 'video', 'audio', 'subtitle', 'music'] as AssetType[]) {
    const assets = await listProductAssets(productId, assetType);
    if (assets.length > keepPerType) {
      const toDelete = assets.slice(keepPerType);
      for (const asset of toDelete) {
        await deleteAsset(asset.path);
        deletedCount++;
      }
    }
  }

  return deletedCount;
}
