import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

// Resolve the canonical origin from the public env var only. This value is
// inlined identically in server and client bundles, so the JSON-LD output is
// stable across SSR and hydration. Falls back to relative URLs when the public
// URL is missing or points at localhost.
function getJsonLdBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return '';
    return url.origin;
  } catch {
    return '';
  }
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const baseUrl = getJsonLdBaseUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${baseUrl}${item.href}` } : {}),
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
