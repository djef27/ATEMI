'use client';

import { useState, useEffect, useCallback, useRef, useId } from 'react';
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
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const { showToast } = useToast();
  const addedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => () => {
    if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const handleAdd = () => {
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
      quantity,
      stock: product.stock,
      vendor_id: product.vendor_id,
      vendor_name: product.vendor_name || '',
    });
    setAdded(true);
    showToast(`${product.name} ajouté au panier`, 'success', <ShoppingBag className="w-5 h-5" aria-hidden="true" />);
    if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    addedTimeoutRef.current = setTimeout(() => setAdded(false), 2000);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 transition-colors group-hover:bg-black/20 group-hover:opacity-100 focus-visible:bg-black/30 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white motion-reduce:transition-none"
        aria-label={`Aperçu rapide de ${product.name}`}
      >
        <span className="px-3 py-2 bg-white rounded-lg text-xs font-medium text-[#1A1919] shadow-lg flex items-center gap-1.5 translate-y-2 transition-transform group-hover:translate-y-0 group-focus-within:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          Aperçu rapide
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] overscroll-contain bg-black/50 flex items-center justify-center p-4"
          role="presentation"
          onClick={close}
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
        >
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
              );
              if (!focusable?.length) {
                event.preventDefault();
                return;
              }
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 id={`${dialogId}-title`} className="font-serif font-semibold text-[#1A1919]">Aperçu rapide</h3>
              <button
                type="button"
                data-dialog-initial-focus
                onClick={close}
                aria-label="Fermer l’aperçu"
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
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
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                      <div role="group" className="flex items-center border border-gray-200 rounded-lg" aria-label="Choisir la quantité">
                        <button
                          type="button"
                          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                          className="p-2 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
                          disabled={quantity <= 1}
                          aria-label="Diminuer la quantité"
                        >
                          <Minus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <output className="w-10 text-center text-sm font-medium" aria-live="polite">{quantity}</output>
                        <button
                          type="button"
                          onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
                          className="p-2 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
                          disabled={quantity >= product.stock}
                          aria-label="Augmenter la quantité"
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleAdd}
                        disabled={product.stock <= 0}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                          added
                            ? 'bg-green-600 text-white'
                            : 'bg-primary-900 text-white hover:bg-primary-800'
                        }`}
                      >
                        {added ? (
                          <>
                            <Check className="w-4 h-4" aria-hidden="true" />
                            Ajouté
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                            Ajouter au panier
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <Link
                    href={`/products/${product.slug}`}
                    onClick={close}
                    className="block w-full text-center py-2.5 text-sm font-medium text-primary-700 hover:text-primary-800 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
