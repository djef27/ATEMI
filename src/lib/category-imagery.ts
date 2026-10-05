export const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  mode: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
  perruques: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80',
  accessoires: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=900&q=80',
  chaussures: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  beaute: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
  sacs: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80',
  bijoux: 'https://images.unsplash.com/photo-1583292650898-7d22cd27ca6f?auto=format&fit=crop&w=900&q=80',
  maison: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80',
  electronique: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?auto=format&fit=crop&w=900&q=80',
  autres: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
};

export const GENERIC_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80';

export function getCategoryImage(slug?: string | null, fallback?: string | null): string {
  const normalized = (slug ?? '').trim().toLowerCase();
  return fallback || CATEGORY_IMAGE_FALLBACKS[normalized] || GENERIC_CATEGORY_IMAGE;
}