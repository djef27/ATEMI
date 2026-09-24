import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/vendor/', '/api/', '/mobile-preview/', '/checkout/', '/cart/', '/paiement/', '/recu/', '/confirmation/', '/mon-compte/', '/mes-commandes/'],
      },
    ],
    sitemap: 'https://atemi.bj/sitemap.xml',
  };
}
