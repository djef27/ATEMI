'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getCategoryImage } from '@/lib/category-imagery';
import { formatPrice } from '@/lib/utils';
import type { PublicProduct } from '@/types';
import QuickViewModal from './quick-view-modal';

interface ProductCardProps {
  product: PublicProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  const imageUrl = (product as PublicProduct & { image_url?: string | null }).image_url || null;
  const categorySlug = product.category?.slug || '';
  const resolvedImage = imageUrl || getCategoryImage(categorySlug);

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="relative aspect-[3/4] overflow-hidden bg-primary-50">
          <Image
            src={resolvedImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.stock <= 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-900">
                Rupture de stock
              </span>
            </div>
          )}
          <QuickViewModal product={{ ...product, image_url: resolvedImage }} />
        </div>

        <div className="p-4">
          {product.category && (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-primary-400">
              {product.category.name}
            </p>
          )}
          {product.vendor_name && (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-primary-500">
              {product.vendor_name}
            </p>
          )}
          <h3 className="line-clamp-2 font-serif text-sm font-semibold text-[#1A1919] transition-colors group-hover:text-primary-700 sm:text-base">
            {product.name}
          </h3>
          <div className="mt-2">
            <span className="text-base font-bold text-[#1A1919] sm:text-lg">
              {formatPrice(product.selling_price)}
            </span>
          </div>
          <p className="mt-1 text-xs text-primary-500">Acompte : {formatPrice(product.deposit_amount)}</p>
        </div>
      </div>
    </Link>
  );
}