import Link from 'next/link';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="relative h-[70vh] min-h-[500px] sm:h-[85vh] sm:min-h-[600px] max-h-[900px] bg-[#1A1919] overflow-hidden">
      <Image
        src="https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=1920&h=1080&fit=crop&q=80"
        alt="Collection Atémi — Mode africaine contemporaine"
        fill
        priority
        className="object-cover object-center opacity-50 scale-105"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#1A1919]/95 via-[#1A1919]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1A1919]/40 via-transparent to-transparent" />

      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center z-10">
        <div className="max-w-2xl">
          <p className="tagline text-primary-400 mb-4">
            Collection Atémi
          </p>
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] tracking-tight">
            Les talents d’Afrique,
            <span className="text-primary-400"> à portée de main</span>
          </h1>
          <p className="mt-4 sm:mt-5 text-base sm:text-xl text-gray-300 max-w-lg leading-relaxed">
            Créations et vendeurs d&apos;Afrique, disponibles au Bénin.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link
              href="/products"
              className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-white text-[#1A1919] font-semibold text-sm sm:text-base hover:bg-gray-100 transition-[background-color,box-shadow,transform] duration-300 motion-reduce:transition-none hover:shadow-lg hover:scale-[1.02] text-center"
            >
              Découvrir la collection
            </Link>
            <Link
              href="/comment-ca-marche"
              className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl border border-white/30 text-white font-semibold text-sm sm:text-base hover:bg-white/10 transition-[background-color,border-color] duration-300 hover:border-white/50 text-center"
            >
              Comment ça marche
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
