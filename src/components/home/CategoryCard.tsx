import Link from 'next/link';
import Image from 'next/image';

interface CategoryCardProps {
  name: string;
  slug: string;
  imageUrl: string | null;
}

const FALLBACK_IMAGES: Record<string, string> = {
  mode: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=800&fit=crop&q=80',
  perruques: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=800&fit=crop&q=80',
  accessoires: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600&h=800&fit=crop&q=80',
  chaussures: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=800&fit=crop&q=80',
  beaute: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=800&fit=crop&q=80',
  sacs: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=800&fit=crop&q=80',
  bijoux: 'https://images.unsplash.com/photo-1583292650898-7d22cd27ca6f?w=600&h=800&fit=crop&q=80',
  maison: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=800&fit=crop&q=80',
  electronique: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=600&h=800&fit=crop&q=80',
  autres: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=800&fit=crop&q=80',
};

export default function CategoryCard({ name, slug, imageUrl }: CategoryCardProps) {
  const finalImage = imageUrl || FALLBACK_IMAGES[slug] || null;

  return (
    <Link href={`/products?category=${slug}`} className="group block">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-primary-100 shadow-lg shadow-black/20 group-hover:shadow-xl group-hover:shadow-black/30 transition-shadow duration-500">
        {finalImage ? (
          <Image
            src={finalImage}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            <span className="font-serif text-2xl text-primary-500">{name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <span className="font-serif font-semibold text-white text-lg sm:text-xl">
            {name}
          </span>
        </div>
      </div>
    </Link>
  );
}
