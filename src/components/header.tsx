import { getHomeCategories } from '@/lib/supabase/queries';
import HeaderInner from './header-inner';
import { headers } from 'next/headers';

export default async function Header() {
  let categories: { id: string; name: string; slug: string; image_url: string | null }[] = [];

  try {
    categories = await getHomeCategories();
  } catch {
    // Supabase unavailable — render header without categories
  }

  const headersList = await headers();
  const pathname = headersList.get('x-nextjs-url') || '/';

  return <HeaderInner categories={categories} pathname={pathname} />;
}
