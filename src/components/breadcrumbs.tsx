import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `https://atemi.bj${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-gray-500 mb-4 sm:mb-6 flex-wrap">
        <Link href="/" className="hover:text-primary-700 transition-colors">
          Accueil
        </Link>
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5" />
            {item.href ? (
              <Link href={item.href} className="hover:text-primary-700 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-[#1A1919] font-medium">{item.label}</span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
