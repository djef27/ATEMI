import Image from 'next/image';
import { getCategoryImage } from '@/lib/category-imagery';

const GENERIC_FALLBACK = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80';

interface ProductImageProps {
  src: string | null;
  alt: string;
  categorySlug?: string | null;
  className?: string;
}

export default function ProductImage({ src, alt, categorySlug, className = '' }: ProductImageProps) {
  const resolvedSrc = src || getCategoryImage(categorySlug, GENERIC_FALLBACK);

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      className={`object-cover ${className}`}
    />
  );
}