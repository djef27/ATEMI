'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductGalleryProps {
  images: Array<{ image_url: string; alt_text: string | null }>;
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const open = (idx: number) => setSelectedIndex(idx);
  const close = () => setSelectedIndex(null);
  const prev = () => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : images.length - 1));
  const next = () => setSelectedIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : 0));

  if (images.length === 0) return null;

  return (
    <>
      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((img, idx) => (
            <button
              key={idx}
              onClick={() => open(idx)}
              className="aspect-square bg-white rounded-lg border border-primary-100 shadow-sm overflow-hidden relative focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <Image
                src={img.image_url}
                alt={img.alt_text || ''}
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
          className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center"
          onClick={close}
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white z-10"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>

          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 p-2 text-white/70 hover:text-white z-10"
              aria-label="Image précédente"
            >
              <ChevronLeft className="w-8 h-8" />
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
              className="absolute right-4 p-2 text-white/70 hover:text-white z-10"
              aria-label="Image suivante"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-4 flex gap-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === selectedIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                  aria-label={`Image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
