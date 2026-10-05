import Image from 'next/image';
import Link from 'next/link';
import { getCategoryImage } from '@/lib/category-imagery';

interface CategoryCardProps {
  name: string;
  slug: string;
  imageUrl: string | null;
}

export default function CategoryCard({ name, slug, imageUrl }: CategoryCardProps) {
  const finalImage = imageUrl || getCategoryImage(slug);

  return (
    <Link href={`/products?category=${slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[1.6rem] border border-[#f0e7df] bg-[#f6efe8] shadow-[0_18px_48px_rgba(61,44,31,0.10)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_22px_56px_rgba(61,44,31,0.14)]">
        <Image
          src={finalImage}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120d0b]/75 via-[#120d0b]/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <span className="font-serif text-lg font-semibold text-white sm:text-xl">{name}</span>
        </div>
      </div>
    </Link>
  );
}