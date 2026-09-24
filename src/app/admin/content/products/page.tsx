'use client';

import { useState, useEffect } from 'react';
import { Search, Zap, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  slug: string;
  selling_price: number;
  stock: number;
  status: string;
  image_url?: string;
  category?: { name: string };
}

interface PipelineStatus {
  hasProject: boolean;
  status: string;
  conceptsCount: number;
  imagesCount: number;
  queueCount: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch('/api/admin/produits');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function analyzeProduct(productId: string) {
    setAnalyzing(productId);
    try {
      const res = await fetch(`/api/content-engine/products/${productId}/analyze`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert('Analyse terminée !');
        fetchProducts();
      } else {
        alert(data.error || 'Erreur lors de l\'analyse');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setAnalyzing(null);
    }
  }

  async function generateContent(productId: string) {
    setGenerating(productId);
    try {
      const res = await fetch(`/api/content-engine/products/${productId}/concepts`, {
        method: 'POST',
        body: JSON.stringify({ platforms: ['tiktok', 'instagram', 'facebook'] }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.data.conceptsCount} concepts générés !`);
        fetchProducts();
      } else {
        alert(data.error || 'Erreur lors de la génération');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setGenerating(null);
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#1A1919]">Produits</h2>
        <p className="text-sm text-gray-500 mt-1">Analysez vos produits et générez du contenu</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Chargement...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-primary-100">
          <p className="text-gray-500">Aucun produit trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl border border-primary-100 overflow-hidden shadow-sm">
              {/* Product Image */}
              <div className="aspect-square bg-primary-50 relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary-300">
                    <span className="text-4xl">📦</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {product.status}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-medium text-[#1A1919] line-clamp-1">{product.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {product.category?.name || 'Sans catégorie'} · {product.stock} en stock
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => analyzeProduct(product.id)}
                    disabled={analyzing === product.id || generating === product.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-100 text-primary-700 text-sm font-medium hover:bg-primary-200 disabled:opacity-50 transition-colors"
                  >
                    {analyzing === product.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Analyser
                  </button>
                  <button
                    onClick={() => generateContent(product.id)}
                    disabled={analyzing === product.id || generating === product.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
                  >
                    {generating === product.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Générer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
