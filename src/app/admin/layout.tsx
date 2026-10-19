'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Users, Package, Tag, CreditCard, Truck, ArrowLeft, Zap, MoreHorizontal, X } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/commandes', label: 'Commandes', icon: ShoppingCart },
  { href: '/admin/paiements', label: 'Paiements', icon: CreditCard },
  { href: '/admin/vendeurs', label: 'Vendeurs', icon: Users },
  { href: '/admin/produits', label: 'Produits', icon: Package },
  { href: '/admin/categories', label: 'Catégories', icon: Tag },
  { href: '/admin/livraison', label: 'Livraison', icon: Truck },
  { href: '/admin/content', label: 'Publicités', icon: Zap },
];

// Primary items for mobile bottom bar (most frequently used)
const primaryNavItems = navItems.slice(0, 5);
// Secondary items for "More" dropdown
const secondaryNavItems = navItems.slice(5);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-safe lg:pb-0">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 bg-white border-r border-primary-100 min-h-screen p-4">
          <div className="mb-6">
            <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Retour au site
            </Link>
          </div>

          <div className="mb-6 px-3 py-2 bg-red-50 rounded-lg">
            <p className="text-sm font-medium text-red-700">Administration</p>
            <p className="text-xs text-red-600 truncate">{profile?.full_name}</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-red-50 text-red-700'
                      : 'text-gray-600 hover:bg-primary-50 hover:text-[#1A1919]'
                  }`}
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile bottom navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-primary-100 pb-safe">
          <div className="flex items-center justify-around h-14 border-t border-primary-100">
            {primaryNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-red-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {/* More menu */}
            <div className="relative">
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  moreMenuOpen ? 'text-red-700' : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-expanded={moreMenuOpen}
                aria-haspopup="true"
                aria-label="Plus d'options"
              >
                <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
                <span>Plus</span>
              </button>
              {moreMenuOpen && (
                <>
                  <button
                    onClick={() => setMoreMenuOpen(false)}
                    className="fixed inset-0 z-40 lg:hidden"
                    aria-label="Fermer le menu"
                  />
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-primary-100 py-2 z-50">
                    {secondaryNavItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-red-50 text-red-700'
                              : 'text-gray-600 hover:bg-primary-50 hover:text-[#1A1919]'
                          }`}
                        >
                          <item.icon className="w-5 h-5" aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                    <button
                      onClick={() => setMoreMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-md"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                      Fermer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </nav>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
