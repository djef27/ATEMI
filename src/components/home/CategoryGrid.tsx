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
    <section className="relative bg-[#1A1919] py-16 sm:py-20 overflow-hidden texture-african">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent-900/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <ScrollReveal>
          <SectionHeader
            tagline="Par catégorie"
            title="Trouvez votre style"
            align="center"
            light
          />
        </ScrollReveal>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
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
