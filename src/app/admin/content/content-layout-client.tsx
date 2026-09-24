'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Clock, Calendar, Settings, Zap, AlertTriangle } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/content', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { href: '/admin/content/products', label: 'Produits', icon: Package },
  { href: '/admin/content/queue', label: 'File d\'attente', icon: Clock },
  { href: '/admin/content/schedule', label: 'Calendrier', icon: Calendar },
  { href: '/admin/content/settings', label: 'Paramètres', icon: Settings },
];

export default function ContentLayoutClient({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="bg-white border-b border-primary-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Zap className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold text-[#1A1919]">Content Engine</h1>
              <p className="text-xs text-gray-500">Automatisation marketing Atémi</p>
            </div>
          </div>
        </div>
      </div>

      {!enabled && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <div className="flex items-start gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-yellow-600" />
            <div>
              <p className="font-semibold">Content Engine désactivé</p>
              <p className="mt-1 text-yellow-700">
                La génération et la publication automatique sont coupées tant que les fournisseurs
                IA et les intégrations TikTok / Instagram / Facebook ne sont pas implémentés.
                Définir <code className="font-mono">CONTENT_ENGINE_ENABLED=true</code> pour activer.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <nav className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-primary-100 p-2 shadow-sm">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-900 text-white'
                        : 'text-gray-600 hover:bg-primary-50 hover:text-[#1A1919]'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}