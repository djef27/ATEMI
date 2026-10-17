import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/app-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/vendor/', '/api/', '/mobile-preview/', '/checkout/', '/cart/', '/paiement/', '/recu/', '/confirmation/', '/mon-compte/', '/mes-commandes/'],
      },
    ],
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
