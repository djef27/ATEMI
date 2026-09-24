'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/hooks/use-cart';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, User, Menu, X, LogOut, ChevronDown, Package, FileText, ChevronRight, Search } from 'lucide-react';
import type { HomeCategory } from '@/lib/supabase/queries';

interface HeaderInnerProps {
  categories: HomeCategory[];
  pathname?: string;
}

export default function HeaderInner({ categories, pathname = '/' }: HeaderInnerProps) {
  const { user, profile, loading, signOut } = useAuth();
  const getItemCount = useCart((state) => state.getItemCount);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const itemCount = getItemCount();

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  }, [searchQuery, router]);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1A1919]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo - fixed width */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight italic">
              Atémi
            </span>
          </Link>

          {/* Center nav - desktop */}
          <nav className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 flex-1 mx-4">
            {/* Shop dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setShopOpen(true)}
              onMouseLeave={() => setShopOpen(false)}
            >
              <button
                className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                onClick={() => setShopOpen(!shopOpen)}
                aria-expanded={shopOpen}
                aria-haspopup="true"
              >
                Boutique
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${shopOpen ? 'rotate-180' : ''}`} />
              </button>

              {shopOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3">
                  <div className="bg-white rounded-xl shadow-xl border border-primary-100 py-3 min-w-[220px]">
                    <Link
                      href="/products"
                      className="block px-5 py-2.5 text-sm text-[#1A1919] hover:bg-primary-50 font-medium"
                    >
                      Tous les produits
                    </Link>
                    {categories.map((cat) => {
                      const isActive = pathname.includes(`category=${cat.slug}`);
                      return (
                        <Link
                          key={cat.id}
                          href={`/products?category=${cat.slug}`}
                          className={`block px-5 py-2.5 text-sm hover:bg-primary-50 ${
                            isActive ? 'text-primary-700 font-medium bg-primary-50' : 'text-gray-700'
                          }`}
                        >
                          {cat.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Link href="/products?sort=new" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Nouveautés
            </Link>
            <Link href="/products?sort=best" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Meilleures ventes
            </Link>
            <Link href="/comment-ca-marche" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Comment ça marche
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Desktop search */}
            <form onSubmit={handleSearch} className="hidden lg:flex items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-40 lg:w-48 pl-9 pr-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent focus:w-56 lg:focus:w-64 transition-all"
                />
              </div>
            </form>

            {/* Mobile search icon */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="lg:hidden p-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>

            <Link
              href="/cart"
              className="relative p-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label={`Panier (${itemCount} article${itemCount !== 1 ? 's' : ''})`}
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>

            {loading ? (
              <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="hidden sm:inline truncate max-w-[100px]">
                    {profile?.full_name || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-primary-100 py-2 z-50">
                      <div className="px-4 py-3 border-b border-primary-100">
                        <p className="text-sm font-medium text-[#1A1919] truncate">
                          {profile?.full_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>

                      <Link
                        href="/mon-compte"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50"
                      >
                        <User className="w-4 h-4" />
                        Mon compte
                      </Link>

                      <Link
                        href="/mes-commandes"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50"
                      >
                        <Package className="w-4 h-4" />
                        Mes commandes
                      </Link>

                      <Link
                        href="/recu"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50"
                      >
                        <FileText className="w-4 h-4" />
                        Mes reçus
                      </Link>

                      {profile?.role === 'vendor' && (
                        <Link
                          href="/vendor"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50"
                        >
                          Espace vendeur
                        </Link>
                      )}

                      {profile?.role === 'admin' && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50"
                        >
                          Administration
                        </Link>
                      )}

                      <div className="border-t border-primary-100 mt-1 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                        >
                          <LogOut className="w-4 h-4" />
                          Déconnexion
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block"
                >
                  Connexion
                </Link>
                <Link
                  href="/products"
                  className="px-5 py-2.5 text-sm font-medium text-[#1A1919] bg-white rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Boutique
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-white/10 py-4 space-y-1">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
            >
              Accueil
            </Link>

            {/* Mobile categories */}
            <div className="px-4 py-2">
              <p className="text-xs font-medium tracking-wider uppercase text-gray-500 mb-2">Boutique</p>
              <Link
                href="/products"
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm text-gray-300 hover:text-white"
              >
                Tous les produits
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="block py-2 text-sm text-gray-300 hover:text-white"
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            <Link
              href="/products?sort=new"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
            >
              Nouveautés
            </Link>
            <Link
              href="/products?sort=best"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
            >
              Meilleures ventes
            </Link>
            <Link
              href="/comment-ca-marche"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
            >
              Comment ça marche
            </Link>

            <div className="border-t border-white/10 mt-2 pt-2 px-4 space-y-2">
              {!user && (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-center px-4 py-3 text-sm font-medium text-gray-300 border border-white/20 rounded-lg hover:bg-white/10"
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-center px-4 py-3 text-sm font-medium text-[#1A1919] bg-white rounded-lg hover:bg-gray-100"
                  >
                    Inscription
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        {/* Mobile search overlay */}
        {searchOpen && (
          <div className="lg:hidden border-t border-white/10 py-4">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit..."
                  autoFocus
                  className="w-full pl-9 pr-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="p-3 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
