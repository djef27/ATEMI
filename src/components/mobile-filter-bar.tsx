'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface MobileFilterBarProps {
  categories: Category[];
}

const SORT_OPTIONS = [
  { value: 'new', label: 'Nouveautés' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom A-Z' },
];

export default function MobileFilterBar({ categories }: MobileFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCategory = searchParams.get('category') || '';
  const currentSort = searchParams.get('sort') || 'new';

  const [catOpen, setCatOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const catRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const activeCatLabel = currentCategory
    ? categories.find((c) => c.slug === currentCategory)?.name || 'Tout'
    : 'Tout';

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label || 'Nouveautés';

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navigate = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => {
        router.push(`/products?${params.toString()}`);
      });
    },
    [router, startTransition],
  );

  const selectCategory = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slug) {
        params.set('category', slug);
      } else {
        params.delete('category');
      }
      setCatOpen(false);
      navigate(params);
    },
    [searchParams, navigate],
  );

  const selectSort = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'new') {
        params.delete('sort');
      } else {
        params.set('sort', value);
      }
      setSortOpen(false);
      navigate(params);
    },
    [searchParams, navigate],
  );

  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Category dropdown */}
      <div ref={catRef} className="relative flex-1 min-w-0">
        <button
          onClick={() => { setCatOpen((o) => !o); setSortOpen(false); }}
          disabled={isPending}
          aria-haspopup="listbox"
          aria-expanded={catOpen}
          className="w-full flex items-center justify-between gap-1 px-3 py-2.5 rounded-xl border border-primary-200 bg-white text-sm font-medium text-[#1A1919] hover:border-primary-400 transition-colors disabled:opacity-50 truncate"
        >
          <span className="truncate">{activeCatLabel}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${catOpen ? 'rotate-180' : ''}`} />
        </button>
        {catOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-primary-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto" role="listbox">
            <button
              onClick={() => selectCategory('')}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-primary-50 transition-colors ${
                !currentCategory ? 'bg-primary-50 font-medium text-primary-900' : 'text-gray-700'
              }`}
              role="option"
              aria-selected={!currentCategory}
            >
              Tout
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.slug)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-primary-50 transition-colors ${
                  currentCategory === cat.slug ? 'bg-primary-50 font-medium text-primary-900' : 'text-gray-700'
                }`}
                role="option"
                aria-selected={currentCategory === cat.slug}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort dropdown */}
      <div ref={sortRef} className="relative flex-1 min-w-0">
        <button
          onClick={() => { setSortOpen((o) => !o); setCatOpen(false); }}
          disabled={isPending}
          aria-haspopup="listbox"
          aria-expanded={sortOpen}
          className="w-full flex items-center justify-between gap-1 px-3 py-2.5 rounded-xl border border-primary-200 bg-white text-sm font-medium text-[#1A1919] hover:border-primary-400 transition-colors disabled:opacity-50 truncate"
        >
          <span className="truncate">{activeSortLabel}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
        </button>
        {sortOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-primary-200 rounded-xl shadow-lg z-50" role="listbox">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectSort(opt.value)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-primary-50 transition-colors ${
                  currentSort === opt.value ? 'bg-primary-50 font-medium text-primary-900' : 'text-gray-700'
                }`}
                role="option"
                aria-selected={currentSort === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
