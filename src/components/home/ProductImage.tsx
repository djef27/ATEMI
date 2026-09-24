import Image from 'next/image';

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

interface ProductImageProps {
  src: string | null;
  alt: string;
  categorySlug?: string | null;
  className?: string;
}

export default function ProductImage({ src, alt, categorySlug, className = '' }: ProductImageProps) {
  const resolvedSrc = src || (categorySlug ? CATEGORY_FALLBACKS[categorySlug] : null) || GENERIC_FALLBACK;

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
