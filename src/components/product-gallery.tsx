'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductGalleryProps {
  images: Array<{ image_url: string; alt_text: string | null }>;
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const open = (idx: number, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setSelectedIndex(idx);
  };
  const close = useCallback(() => setSelectedIndex(null), []);
  const prev = useCallback(
    () => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : images.length - 1)),
    [images.length]
  );
  const next = useCallback(
    () => setSelectedIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : 0)),
    [images.length]
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

  if (images.length === 0) return null;

  return (
    <>
      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((img, idx) => (
            <button
              key={idx}
              onClick={(e) => open(idx, e.currentTarget)}
              className="aspect-square bg-white rounded-lg border border-primary-100 shadow-sm overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label={`Agrandir l’image ${idx + 1} de ${productName}`}
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
        </div>
      )}

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie de ${productName}`}
          tabIndex={-1}
          className="fixed inset-0 z-[90] overscroll-contain bg-black/90 flex items-center justify-center focus-visible:outline-none"
          onClick={close}
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>

          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 p-2 text-white/70 hover:text-white z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
              aria-label="Image précédente"
            >
              <ChevronLeft className="w-8 h-8" aria-hidden="true" />
            </button>
          )}

          <div
            className="relative w-full max-w-3xl aspect-square mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[selectedIndex].image_url}
              alt={images[selectedIndex].alt_text || productName}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 p-2 text-white/70 hover:text-white z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
              aria-label="Image suivante"
            >
              <ChevronRight className="w-8 h-8" aria-hidden="true" />
            </button>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-4 flex gap-2" role="tablist" aria-label="Choisir une image">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); }}
                  className={`w-2 h-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/0 ${
                    idx === selectedIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                  aria-label={`Image ${idx + 1}`}
                  aria-current={idx === selectedIndex}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
