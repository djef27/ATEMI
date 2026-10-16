import { getHomeCategories } from '@/lib/supabase/queries';
import HeaderInner from './header-inner';

export default async function Header() {
  let categories: { id: string; name: string; slug: string; image_url: string | null }[] = [];

  try {
    categories = await getHomeCategories();
  } catch {
    // Supabase unavailable — render header without categories
  }

  return <HeaderInner categories={categories} />;
}
