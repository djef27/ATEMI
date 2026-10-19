import { getHomeCategories, type HomeCategory } from '@/lib/supabase/queries';
import CategoryCard from './CategoryCard';
import SectionHeader from './SectionHeader';
import { ScrollReveal } from './ScrollReveal';

export default async function CategoryGrid() {
  let categories: HomeCategory[] = [];
  try {
    categories = await getHomeCategories();
  } catch {
    return null;
  }

  if (categories.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-[#fbf8f3] py-16 sm:py-24">
      <div aria-hidden="true" className="absolute -right-28 top-10 h-72 w-72 rounded-full border border-[#a9876a]/15 sm:h-[26rem] sm:w-[26rem]" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <ScrollReveal>
          <SectionHeader
            tagline="Par catégorie"
            title="Des envies, des univers"
            description="Les sélections de nos vendeurs."
            align="center"
          />
        </ScrollReveal>

        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat, idx) => (
            <ScrollReveal key={cat.id} delay={idx * 100}>
              <CategoryCard
                name={cat.name}
                slug={cat.slug}
                imageUrl={cat.image_url}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
