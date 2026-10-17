import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react';

export default function CatalogHero() {
  return (
    <section className="relative overflow-hidden bg-[#fbf8f3]">
      <div className="absolute inset-0">
        <Image
          src="/images/hero-catalogue.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={70}
          className="object-cover object-center"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(251,248,243,1) 0%, rgba(251,248,243,0.99) 40%, rgba(251,248,243,0.82) 65%, rgba(251,248,243,0.45) 85%, rgba(251,248,243,0.1) 100%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-[#fbf8f3]/30 md:hidden" />
      <div aria-hidden="true" className="absolute -right-24 -top-36 h-[24rem] w-[24rem] rounded-full border border-[#a9876a]/20 sm:-right-12 sm:h-[34rem] sm:w-[34rem]" />
      <div aria-hidden="true" className="absolute right-16 top-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,#c98f6a_0_1px,transparent_1.5px)] bg-[length:14px_14px] opacity-30 sm:right-36 sm:top-16 sm:h-48 sm:w-48" />

      <div className="relative mx-auto flex min-h-[280px] max-w-7xl items-center justify-between gap-8 px-4 py-12 sm:min-h-[340px] sm:px-6 sm:py-16">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b6548] sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            La boutique des belles découvertes
          </p>
          <h1 className="font-serif text-4xl font-medium leading-[1.02] tracking-[-0.035em] text-[#2d2118] sm:text-6xl">
            Le catalogue
            <span className="block italic text-[#a45d3d]">Atémi.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#62584f] sm:text-base sm:leading-7">
            Mode, beauté, accessoires et trouvailles sélectionnés par les vendeurs Atémi.
            Notre premier marché est le Bénin ; les zones desservies sont indiquées au checkout.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="#products"
              className="group inline-flex items-center gap-2 rounded-full bg-[#2d2118] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#493525] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a45d3d] focus-visible:ring-offset-2"
            >
              Parcourir les produits
              <ArrowDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
            </Link>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-[#76553e]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a45d3d]" />
              Options de paiement précisées au checkout
            </span>
          </div>
        </div>

        <Link
          href="#products"
          aria-label="Voir les produits du catalogue"
          className="relative z-10 hidden h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#a45d3d]/30 bg-white/40 text-[#493525] transition hover:-translate-y-1 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a45d3d] md:flex"
        >
          <ArrowUpRight className="h-6 w-6" />
        </Link>
      </div>
    </section>
  );
}
