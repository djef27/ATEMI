'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

const SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1745669702821-b994a8b9ad78?w=1920&h=600&fit=crop&q=80',
    alt: 'Mode africaine élégante — tenue traditionnelle',
  },
  {
    src: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1920&h=600&fit=crop&q=80',
    alt: 'Perruques et coiffures afro tendance',
  },
  {
    src: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=1920&h=600&fit=crop&q=80',
    alt: 'Shopping et marché africain',
  },
  {
    src: 'https://images.unsplash.com/photo-1774380479597-5e659025a777?w=1920&h=600&fit=crop&q=80',
    alt: 'Collection tendance — style africain moderne',
  },
  {
    src: 'https://images.unsplash.com/photo-1766107349536-c6de9ab38dcd?w=1920&h=600&fit=crop&q=80',
    alt: 'Bijoux et accessoires africains',
  },
];

export default function CatalogHero() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 4500);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section className="relative h-[200px] sm:h-[280px] lg:h-[340px] overflow-hidden bg-[#1A1919]">
      {SLIDES.map((slide, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
            idx === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            className="object-cover scale-105"
            sizes="100vw"
            priority={idx === 0}
          />
        </div>
      ))}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1A1919]/80 via-[#1A1919]/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1A1919]/60 via-transparent to-[#1A1919]/20" />

      {/* Dots */}
      <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 z-10">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === current ? 'bg-primary-400 w-8' : 'bg-white/30 hover:bg-white/50 w-1.5'
            }`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center z-10">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-serif mb-2 sm:mb-3 drop-shadow-lg">
            Catalogue
          </h1>
          <p className="text-gray-300 text-xs sm:text-sm lg:text-base drop-shadow">
            Mode, perruques, bijoux et accessoires — livraison à domicile
          </p>
        </div>
      </div>
    </section>
  );
}
