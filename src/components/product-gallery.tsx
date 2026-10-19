'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface ProductGalleryProps {
  images: Array<{ image_url: string; alt_text: string | null }>;
  videos: Array<{ image_url: string; alt_text: string | null }>;
  productName: string;
}

export default function ProductGallery({ images, videos, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video' | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const allMedia = [
    ...images.map(img => ({ ...img, media_type: 'image' as const })),
    ...videos.map(vid => ({ ...vid, media_type: 'video' as const })),
  ];

  const open = (idx: number, trigger: HTMLButtonElement, mediaType: 'image' | 'video') => {
    lastTriggerRef.current = trigger;
    setSelectedIndex(idx);
    setSelectedMediaType(mediaType);
  };

  const close = useCallback(() => {
    setSelectedIndex(null);
    setSelectedMediaType(null);
  }, []);

  const prev = useCallback(
    () => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : allMedia.length - 1)),
    [allMedia.length]
  );
  const next = useCallback(
    () => setSelectedIndex((i) => (i !== null && i < allMedia.length - 1 ? i + 1 : 0)),
    [allMedia.length]
  );

  useEffect(() => {
    if (selectedIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      lastTriggerRef.current?.focus();
    };
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex, close, prev, next]);

  if (images.length === 0 && videos.length === 0) return null;

  return (
    <>
      {/* Thumbnails */}
      {(images.length > 1 || videos.length > 0) && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((img, idx) => (
            <button
              key={`img-${idx}`}
              onClick={(e) => open(idx, e.currentTarget, 'image')}
              className="aspect-square bg-white rounded-lg border border-primary-100 shadow-sm overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label={`Agrandir l'image ${idx + 1} de ${productName}`}
            >
              <Image
                src={img.image_url}
                alt={img.alt_text || `${productName} — vue ${idx + 1}`}
                fill
                sizes="100px"
                className="object-cover"
              />
            </button>
          ))}
          {videos.slice(0, Math.max(0, 4 - images.length)).map((vid, idx) => (
            <button
              key={`vid-${idx}`}
              onClick={(e) => open(idx, e.currentTarget, 'video')}
              className="aspect-square bg-white rounded-lg border border-primary-100 shadow-sm overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label={`Agrandir la vidéo ${idx + 1} de ${productName}`}
            >
              <video
                src={vid.image_url}
                poster={vid.image_url}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-10 h-10 text-white/90" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedIndex !== null && selectedMediaType && (
        <>
          {/* Backdrop - click to close */}
          <div
            className="fixed inset-0 bg-black/90 z-[89]"
            onClick={close}
            aria-hidden="true"
          />
          {/* Mobile menu panel - fixed, scrollable, with safe area support */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Galerie de ${productName}`}
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-50 lg:hidden w-full max-w-sm bg-black/95 border-l border-white/10 flex flex-col overscroll-contain"
          >
            {/* Sticky header with close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-black/95 backdrop-blur-sm z-10">
              <h2 className="text-sm font-semibold text-white">Galerie</h2>
              <button
                onClick={close}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable content area - uses dynamic viewport height for mobile browsers */}
            <nav className="flex-1 overflow-y-auto overscroll-contain py-4 space-y-1 pb-safe max-h-[calc(100dvh-4rem)]">
              {/* Media display */}
              <div className="relative w-full max-w-3xl aspect-square mx-4" onClick={(e) => e.stopPropagation()}>
                {selectedMediaType === 'image' ? (
                  <>
                    <Image
                      src={allMedia[selectedIndex].image_url}
                      alt={allMedia[selectedIndex].alt_text || productName}
                      fill
                      sizes="100vw"
                      className="object-contain"
                      priority
                    />
                  </>
                ) : (
                  <>
                    <video
                      src={allMedia[selectedIndex].image_url}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                      autoPlay
                    />
                  </>
                )}
              </div>

              {/* Navigation arrows */}
              {allMedia.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prev(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
                    aria-label="Média précédent"
                  >
                    <ChevronLeft className="w-8 h-8" aria-hidden="true" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); next(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
                    aria-label="Média suivant"
                  >
                    <ChevronRight className="w-8 h-8" aria-hidden="true" />
                  </button>
                </>
              )}

              {/* Media type indicator */}
              <div className="absolute top-4 left-4 z-10">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedMediaType === 'image' ? 'bg-blue-600' : 'bg-purple-600'} text-white`}>
                  {selectedMediaType === 'image' ? 'Image' : 'Vidéo'}
                </span>
              </div>

              {/* Indicators */}
              {allMedia.length > 1 && (
                <div className="absolute bottom-4 flex gap-2" role="tablist" aria-label="Choisir un média">
                  {allMedia.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); setSelectedMediaType(allMedia[idx].media_type); }}
                      className={`w-2 h-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/0 ${
                        idx === selectedIndex ? 'bg-white' : 'bg-white/40'
                      }`}
                      aria-label={`Média ${idx + 1}`}
                      aria-current={idx === selectedIndex}
                    />
                  ))}
                </div>
              )}

              {/* Safe area bottom padding for iOS home indicator */}
              <div className="pb-safe h-4" aria-hidden="true" />
            </nav>
          </div>
        </>
      )}
    </>
  );
}