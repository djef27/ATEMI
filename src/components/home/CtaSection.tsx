import Link from 'next/link';
import Image from 'next/image';
import { ScrollReveal } from './ScrollReveal';

export default function CtaSection() {
  return (
    <section className="py-16 sm:py-20 bg-[#FAFAF8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="relative bg-[#1A1919] rounded-2xl p-8 sm:p-12 lg:p-16 text-center overflow-hidden">
            {/* Background image with overlay */}
            <Image
              src="https://images.unsplash.com/photo-1757140448494-ad45016d456a?w=1200&h=600&fit=crop&q=80"
              alt=""
              fill
              className="object-cover opacity-15"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1A1919]/70 via-[#1A1919]/90 to-[#1A1919]" />

            <div className="relative z-10">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4">
                Prêt à commander ?
              </h2>
              <p className="text-gray-300 mb-8 max-w-lg mx-auto">
                Explorez notre catalogue et trouvez les produits qui vous correspondent.
              </p>
              <Link
                href="/products"
                className="inline-block px-8 py-4 rounded-xl bg-white text-[#1A1919] font-semibold hover:bg-gray-100 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
              >
                Voir le catalogue
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
