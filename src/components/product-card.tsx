'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { PublicProduct } from '@/types';
import { formatPrice } from '@/lib/utils';
import QuickViewModal from './quick-view-modal';

const CATEGORY_FALLBACKS: Record<string, string> = {
  'mode': 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=750&fit=crop&q=80',
  'chaussures': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=750&fit=crop&q=80',
  'perruques': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=750&fit=crop&q=80',
  'beaute': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=750&fit=crop&q=80',
  'accessoires': 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600&h=750&fit=crop&q=80',
  'sacs': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=750&fit=crop&q=80',
  'bijoux': 'https://images.unsplash.com/photo-1583292650898-7d22cd27ca6f?w=600&h=750&fit=crop&q=80',
  'maison': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=750&fit=crop&q=80',
  'electronique': 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=600&h=750&fit=crop&q=80',
  'autres': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=750&fit=crop&q=80',
};

const GENERIC_FALLBACK = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=750&fit=crop&q=80';

interface ProductCardProps {
  product: PublicProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  const imageUrl = (product as PublicProduct & { image_url?: string | null }).image_url || null;
  const categorySlug = product.category?.slug || '';
  const resolvedImage = imageUrl || CATEGORY_FALLBACKS[categorySlug] || GENERIC_FALLBACK;

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="bg-white rounded-2xl border border-primary-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
        <div className="aspect-[3/4] bg-primary-50 relative overflow-hidden">
          <Image
            src={resolvedImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-medium">
                Rupture de stock
              </span>
            </div>
          )}
          <QuickViewModal product={{ ...product, image_url: resolvedImage }} />
        </div>

        <div className="p-4">
          {product.category && (
            <p className="text-[10px] font-medium tracking-wider uppercase text-primary-400 mb-1">{product.category.name}</p>
          )}
          {product.vendor_name && (
            <p className="text-[10px] font-medium tracking-wider uppercase text-primary-500 mb-1">{product.vendor_name}</p>
          )}
          <h3 className="font-serif font-semibold text-[#1A1919] line-clamp-2 group-hover:text-primary-700 transition-colors text-sm sm:text-base">
            {product.name}
          </h3>
          <div className="mt-2">
            <span className="text-base sm:text-lg font-bold text-[#1A1919]">
              {formatPrice(product.selling_price)}
            </span>
          </div>
          <p className="mt-1 text-xs text-primary-500">
            Acompte : {formatPrice(product.deposit_amount)}
          </p>
        </div>
      </div>
    </Link>
  );
}
