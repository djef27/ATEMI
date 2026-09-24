import Link from 'next/link';
import Image from 'next/image';
import { ScrollReveal } from './ScrollReveal';

export default function PromoBanner() {
  return (
    <section className="py-16 sm:py-20 bg-[#FAFAF8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="relative rounded-2xl overflow-hidden bg-[#1A1919] min-h-[400px] flex items-center">
            <Image
              src="https://images.unsplash.com/photo-1774380479597-5e659025a777?w=1400&h=500&fit=crop&q=80"
              alt="Collection spéciale Atémi — Mode africaine contemporaine"
              fill
              className="object-cover opacity-40"
              sizes="100vw"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#1A1919]/80 via-[#1A1919]/40 to-transparent" />
            <div className="relative z-10 p-8 sm:p-12 lg:p-16 max-w-2xl">
              <p className="tagline text-primary-400 mb-3">Édition spéciale</p>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                Nouvelle collection
                <br />
                disponible
              </h2>
              <p className="text-gray-300 mb-8 max-w-md">
                Découvrez les dernières tendances de la mode béninoise.
                Pièces uniques, stocks limités.
              </p>
              <Link
                href="/products"
                className="inline-block px-8 py-4 rounded-xl bg-white text-[#1A1919] font-semibold hover:bg-gray-100 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
              >
                Explorer maintenant
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
