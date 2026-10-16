'use client';

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, X, Image as ImageIcon, Video, Loader2, Check, AlertCircle } from 'lucide-react';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_IMAGES = 8;
const MAX_VIDEOS = 1;
const COMPRESS_MAX_WIDTH = 1200;
const COMPRESS_QUALITY = 0.8;

export interface UploadedMedia {
  url: string;
  media_type: 'image' | 'video';
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
}

export interface MediaUploadHandle {
  uploadFiles: () => Promise<UploadedMedia[]>;
  hasPendingUploads: () => boolean;
  getMediaCount: () => number;
}

interface MediaUploadProps {
  productId: string;
  existingMedia?: UploadedMedia[];
  onMediaChange: (media: UploadedMedia[]) => void;
  disabled?: boolean;
}

interface PendingFile {
  file: File;
  preview: string;
  media_type: 'image' | 'video';
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  error?: string;
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        let { width, height } = img;

        if (width > COMPRESS_MAX_WIDTH) {
          height = Math.round((height * COMPRESS_MAX_WIDTH) / width);
          width = COMPRESS_MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          COMPRESS_QUALITY
        );
      };

      img.onerror = () => resolve(file);

      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    } catch {
      resolve(file);
    }
  });
}

const MediaUpload = forwardRef<MediaUploadHandle, MediaUploadProps>(
  function MediaUpload({ productId, existingMedia = [], onMediaChange, disabled }, ref) {
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const validateFile = useCallback((file: File, type: 'image' | 'video'): string | null => {
      if (type === 'image') {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          return 'Format non supporté (JPG, PNG, WebP)';
        }
        if (file.size > MAX_IMAGE_SIZE) {
          return `Max ${MAX_IMAGE_SIZE / 1024 / 1024} Mo`;
        }
      } else {
        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
          return 'Format non supporté (MP4)';
        }
        if (file.size > MAX_VIDEO_SIZE) {
          return `Max ${MAX_VIDEO_SIZE / 1024 / 1024} Mo`;
        }
      }
      return null;
    }, []);

    const handleFileSelect = useCallback((files: FileList | null, type: 'image' | 'video') => {
      if (!files) return;

      const currentImages = pendingFiles.filter(f => f.media_type === 'image' && !f.uploaded).length;
      const existingImages = existingMedia.filter(m => m.media_type === 'image').length;
      const currentVideos = pendingFiles.filter(f => f.media_type === 'video' && !f.uploaded).length;
      const existingVideos = existingMedia.filter(m => m.media_type === 'video').length;

      const newPending: PendingFile[] = [];

      Array.from(files).forEach((file) => {
        if (type === 'image' && currentImages + existingImages + newPending.filter(p => p.media_type === 'image').length >= MAX_IMAGES) {
          return;
        }
        if (type === 'video' && currentVideos + existingVideos + newPending.filter(p => p.media_type === 'video').length >= MAX_VIDEOS) {
          return;
        }

        const error = validateFile(file, type);
        const preview = URL.createObjectURL(file);

        newPending.push({
          file,
          preview,
          media_type: type,
          uploading: false,
          uploaded: false,
          error: error || undefined,
        });
      });

      setPendingFiles(prev => [...prev, ...newPending]);
    }, [pendingFiles, existingMedia, validateFile]);

    const removePending = useCallback((index: number) => {
      setPendingFiles(prev => {
        const item = prev[index];
        if (item?.preview) URL.revokeObjectURL(item.preview);
        return prev.filter((_, i) => i !== index);
      });
    }, []);

    const uploadOneFile = useCallback(async (pending: PendingFile, index: number): Promise<UploadedMedia | null> => {
      if (pending.uploaded || pending.error) return null;

      let fileToUpload = pending.file;

      if (pending.media_type === 'image') {
        try {
          fileToUpload = await compressImage(pending.file);
        } catch {
          // Use original file if compression fails
        }
      }

      const ext = fileToUpload.name.split('.').pop() || (pending.media_type === 'image' ? 'jpg' : 'mp4');
      const path = `${productId || 'misc'}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      setPendingFiles(prev =>
        prev.map((f, i) => i === index ? { ...f, uploading: true, error: undefined } : f)
      );

      try {
        const { error: uploadError } = await supabase.storage
          .from('product-media')
          .upload(path, fileToUpload, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('[MediaUpload] Storage error:', uploadError.message);
          setPendingFiles(prev =>
            prev.map((f, i) => i === index ? { ...f, uploading: false, error: `Échec: ${uploadError.message}` } : f)
          );
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('product-media')
          .getPublicUrl(path);

        setPendingFiles(prev =>
          prev.map((f, i) => i === index ? { ...f, uploading: false, uploaded: true, url: urlData.publicUrl } : f)
        );

        return {
          url: urlData.publicUrl,
          media_type: pending.media_type,
          alt_text: '',
          sort_order: index,
          is_primary: false,
        };
      } catch (err) {
        console.error('[MediaUpload] Upload exception:', err);
        setPendingFiles(prev =>
          prev.map((f, i) => i === index ? { ...f, uploading: false, error: 'Erreur réseau' } : f)
        );
        return null;
      }
    }, [productId, supabase]);

    const uploadFiles = useCallback(async (): Promise<UploadedMedia[]> => {
      const toUpload = pendingFiles.filter(f => !f.uploaded && !f.error);
      if (toUpload.length === 0) return existingMedia;

      setUploading(true);

      // Upload sequentially to avoid overwhelming the network
      const results: (UploadedMedia | null)[] = [];
      for (let i = 0; i < pendingFiles.length; i++) {
        if (!pendingFiles[i].uploaded && !pendingFiles[i].error) {
          const result = await uploadOneFile(pendingFiles[i], i);
          results.push(result);
        }
      }

      const newMedia = results.filter((r): r is UploadedMedia => r !== null);
      const uploadedMedia: UploadedMedia[] = [...existingMedia, ...newMedia];

      uploadedMedia.forEach((m, i) => {
        m.sort_order = i;
        m.is_primary = i === 0;
      });

      setUploading(false);
      return uploadedMedia;
    }, [pendingFiles, existingMedia, uploadOneFile]);

    useImperativeHandle(ref, () => ({
      uploadFiles,
      hasPendingUploads: () => pendingFiles.some(f => !f.uploaded && !f.error),
      getMediaCount: () => existingMedia.length + pendingFiles.filter(f => f.uploaded).length,
    }), [uploadFiles, pendingFiles, existingMedia]);

    const removeExisting = useCallback((index: number) => {
      const updated = existingMedia.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some(m => m.is_primary)) {
        updated[0].is_primary = true;
      }
      onMediaChange(updated);
    }, [existingMedia, onMediaChange]);

    const setPrimary = useCallback((index: number) => {
      const updated = existingMedia.map((m, i) => ({ ...m, is_primary: i === index }));
      onMediaChange(updated);
    }, [existingMedia, onMediaChange]);

    const totalImages = existingMedia.filter(m => m.media_type === 'image').length +
      pendingFiles.filter(f => f.media_type === 'image' && !f.uploaded).length;
    const totalVideos = existingMedia.filter(m => m.media_type === 'video').length +
      pendingFiles.filter(f => f.media_type === 'video' && !f.uploaded).length;
    const hasUploadedMedia = existingMedia.length > 0 || pendingFiles.some(f => f.uploaded);
    const hasPendingToUpload = pendingFiles.some(f => !f.uploaded && !f.error);
    const hasErrors = pendingFiles.some(f => f.error);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || totalImages >= MAX_IMAGES}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            Photo ({totalImages}/{MAX_IMAGES})
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={disabled || totalVideos >= MAX_VIDEOS}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Video className="w-4 h-4" />
            Vidéo ({totalVideos}/{MAX_VIDEOS})
          </button>
          {hasUploadedMedia && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <Check className="w-3.5 h-3.5" />
              Médias prêts
            </span>
          )}
          {hasErrors && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              Erreur(s)
            </span>
          )}
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { handleFileSelect(e.target.files, 'image'); e.target.value = ''; }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4"
          className="hidden"
          onChange={(e) => { handleFileSelect(e.target.files, 'video'); e.target.value = ''; }}
        />

        {existingMedia.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {existingMedia.map((media, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {media.media_type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.url} alt={media.alt_text || 'Image produit'} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-gray-100">
                    <Video className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {!media.is_primary && (
                    <button
                      type="button"
                      onClick={() => setPrimary(idx)}
                      className="px-2 py-1 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700"
                    >
                      Principal
                    </button>
                  )}
                  {media.is_primary && (
                    <span className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded">
                      Principal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeExisting(idx)}
                    className="p-1 text-white bg-red-500 rounded-full hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {pendingFiles.map((pending, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {pending.media_type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pending.preview} alt="Aperçu" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-gray-100">
                    <Video className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                {pending.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
                {pending.uploaded && (
                  <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                )}
                {pending.error && (
                  <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-2">
                    <span className="text-white text-xs text-center">{pending.error}</span>
                  </div>
                )}
                {!pending.uploading && !pending.uploaded && (
                  <button
                    type="button"
                    onClick={() => removePending(idx)}
                    className="absolute top-1 right-1 p-1 text-white bg-red-500 rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {hasPendingToUpload && (
          <button
            type="button"
            onClick={async () => {
              const result = await uploadFiles();
              onMediaChange(result);
            }}
            disabled={uploading || disabled}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Upload en cours…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Uploader {pendingFiles.filter(f => !f.uploaded && !f.error).length} fichier(s)
              </>
            )}
          </button>
        )}
      </div>
    );
  }
);

export default MediaUpload;
