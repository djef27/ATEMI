'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, ShoppingBag, Minus, Plus, Check, Eye } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/components/toast-provider';
import { formatPrice } from '@/lib/utils';
import type { PublicProduct } from '@/types';

interface QuickViewModalProps {
  product: PublicProduct & { image_url?: string | null; supplier_price?: number };
  trigger?: React.ReactNode;
}

export default function QuickViewModal({ product, trigger }: QuickViewModalProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const { showToast } = useToast();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem({
        product_id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.image_url || null,
        selling_price: product.selling_price,
        supplier_price: product.supplier_price || 0,
        deposit_rate: product.deposit_rate,
        deposit_amount: product.deposit_amount,
        remaining_amount: product.remaining_amount,
        quantity: 1,
        stock: product.stock,
        vendor_id: product.vendor_id,
        vendor_name: product.vendor_name || '',
      });
    }
    setAdded(true);
    showToast(`${product.name} ajouté au panier`, 'success', <ShoppingBag className="w-5 h-5" />);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors opacity-0 group-hover:opacity-100"
        aria-label={`Aperçu rapide de ${product.name}`}
      >
        <span className="px-3 py-2 bg-white rounded-lg text-xs font-medium text-[#1A1919] shadow-lg flex items-center gap-1.5 translate-y-2 group-hover:translate-y-0 transition-transform">
          <Eye className="w-3.5 h-3.5" />
          Aperçu rapide
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-serif font-semibold text-[#1A1919]">Aperçu rapide</h3>
              <button onClick={close} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
              <div className="aspect-square bg-primary-50 relative">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover rounded-tl-2xl sm:rounded-bl-2xl"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary-300">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-6 flex flex-col">
                {product.vendor_name && (
                  <p className="text-[10px] font-medium tracking-wider uppercase text-primary-500 mb-1">
                    {product.vendor_name}
                  </p>
                )}
                <h2 className="font-serif text-xl font-bold text-[#1A1919] mb-3 line-clamp-2">
                  {product.name}
                </h2>

                <div className="mb-4">
                  <span className="text-2xl font-bold text-primary-700">
                    {formatPrice(product.selling_price)}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Acompte ({product.deposit_rate}%) : {formatPrice(product.deposit_amount)}
                  </p>
                </div>

                {product.stock > 0 ? (
                  <p className="text-sm text-green-600 mb-4">
                    En stock ({product.stock} disponible{product.stock > 1 ? 's' : ''})
                  </p>
                ) : (
                  <p className="text-sm text-red-500 mb-4">Rupture de stock</p>
                )}

                <div className="mt-auto space-y-3">
                  {product.stock > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-gray-200 rounded-lg">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                        <button
                          onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                          disabled={quantity >= product.stock}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={handleAdd}
                        disabled={product.stock <= 0}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                          added
                            ? 'bg-green-600 text-white'
                            : 'bg-primary-900 text-white hover:bg-primary-800'
                        }`}
                      >
                        {added ? (
                          <>
                            <Check className="w-4 h-4" />
                            Ajouté
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            Ajouter au panier
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <Link
                    href={`/products/${product.slug}`}
                    onClick={close}
                    className="block w-full text-center py-2.5 text-sm font-medium text-primary-700 hover:text-primary-800 transition-colors"
                  >
                    Voir la fiche complète →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
