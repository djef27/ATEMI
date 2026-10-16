import Link from 'next/link';
import type { HomeProduct } from '@/lib/supabase/queries';
import { formatPrice } from '@/lib/utils';
import ProductImage from './ProductImage';
import SectionHeader from './SectionHeader';
import { ScrollReveal } from './ScrollReveal';

interface ProductGridProps {
  tagline: string;
  title: string;
  products: HomeProduct[];
  viewAllHref?: string;
}

export default function ProductGrid({ tagline, title, products, viewAllHref }: ProductGridProps) {
  return (
    <section aria-labelledby={`product-grid-${title}`} className="relative bg-[#1A1919] py-16 sm:py-20 overflow-hidden texture-noise">
      {/* Subtle top border glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-700/30 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <ScrollReveal>
          <div className="flex items-end justify-between mb-8 sm:mb-12">
            <div id={`product-grid-${title}`}>
              <SectionHeader tagline={tagline} title={title} light />
            </div>
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="hidden sm:inline-block text-sm text-primary-400 hover:text-primary-300 transition-colors font-medium pb-1"
              >
                Tout voir →
              </Link>
            )}
          </div>
        </ScrollReveal>

        {products.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide sm:overflow-visible sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:snap-none">
            {products.map((product, idx) => (
              <ScrollReveal key={product.id} delay={idx * 80}>
                <Link
                  href={`/products/${product.slug}`}
                  className="group block snap-start shrink-0 w-[260px] sm:w-auto"
                >
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-primary-100 mb-3 shadow-lg shadow-black/20">
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    categorySlug={product.category_slug}
                    className="group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1 rounded-full bg-white/90 text-[#1A1919] text-xs font-medium backdrop-blur-sm">
                      Acompte {product.deposit_rate}%
                    </span>
                  </div>
                </div>

                <div>
                  {product.vendor_name && (
                    <p className="text-[10px] font-medium tracking-wider uppercase text-primary-400 mb-1">
                      {product.vendor_name}
                      {product.vendor_city && ` · ${product.vendor_city}`}
                    </p>
                  )}
                  <h3 className="font-serif font-semibold text-white text-sm sm:text-base line-clamp-2 group-hover:text-primary-300 transition-colors">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm text-white font-medium">
                    {formatPrice(product.selling_price)}
                  </p>
                </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <div role="status" className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center text-gray-300">
            <p className="font-medium text-white">Notre sélection est momentanément indisponible.</p>
            <p className="mt-2 text-sm">Vous pouvez consulter le catalogue complet ou revenir dans quelques instants.</p>
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="mt-5 inline-flex rounded-xl border border-white/20 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Consulter le catalogue
              </Link>
            )}
          </div>
        )}

        {viewAllHref && (
          <div className="mt-8 text-center sm:hidden">
            <Link
              href={viewAllHref}
              className="inline-block px-6 py-3 rounded-xl border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Tout voir →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
