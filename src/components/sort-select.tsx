'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

export default function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const currentSort = searchParams.get('sort') || 'new';

  const handleChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'new') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }
    startTransition(() => {
      router.push(`/products?${params.toString()}`);
    });
  }, [searchParams, router]);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm text-gray-500 whitespace-nowrap">Trier par</label>
      <select
        id="sort"
        defaultValue={currentSort}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="px-3 py-2 rounded-lg border border-primary-200 bg-white text-sm text-[#1A1919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50"
      >
        <option value="new">Nouveautés</option>
        <option value="price_asc">Prix croissant</option>
        <option value="price_desc">Prix décroissant</option>
        <option value="name">Nom A-Z</option>
      </select>
    </div>
  );
}
