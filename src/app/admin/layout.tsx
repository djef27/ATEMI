'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { LayoutDashboard, ShoppingCart, Users, Package, Tag, CreditCard, Truck, ArrowLeft, Zap } from 'lucide-react';

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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="flex">
        <aside className="hidden lg:block w-64 bg-white border-r border-primary-100 min-h-screen p-4">
          <div className="mb-6">
            <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" />
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
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
