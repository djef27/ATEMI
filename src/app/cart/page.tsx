'use client';

import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { useHydratedCart } from '@/stores/cart';
import CartItemRow from '@/components/cart-item-row';
import Breadcrumbs from '@/components/breadcrumbs';
import { ShoppingBag, ArrowLeft, Store } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { CartItem } from '@/types';
import { Loader2 } from 'lucide-react';

function groupByVendor(items: CartItem[]): Map<string, CartItem[]> {
  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const key = item.vendor_name || 'Autre vendeur';
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

export default function CartPage() {
  const { items: cartItems, itemCount, hydrated } = useHydratedCart();
  const { getSubtotal, getDeposit, getRemaining, clearCart } = useCart();
  const subtotal = getSubtotal();
  const deposit = getDeposit();
  const remaining = getRemaining();

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#1A1919] mb-2">Votre panier est vide</h1>
            <p className="text-gray-600 mb-6">
              Parcourez le catalogue.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voir le catalogue
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: 'Panier' }]} />
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl font-bold text-[#1A1919]">
            Panier ({itemCount} article{itemCount > 1 ? 's' : ''})
          </h1>
          <button
            onClick={() => {
              if (window.confirm('Voulez-vous vraiment vider votre panier ?')) clearCart();
            }}
            className="rounded-sm text-sm text-rose-600 hover:text-rose-700 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Vider le panier
          </button>
        </div>

        <div className="space-y-6 mb-8">
          {Array.from(groupByVendor(cartItems).entries()).map(([vendorName, vendorItems]) => (
            <div key={vendorName}>
              <div className="flex items-center gap-2 mb-3">
                <Store className="w-4 h-4 text-primary-500" />
                <h3 className="text-sm font-medium text-[#1A1919]">{vendorName}</h3>
              </div>
              <div className="space-y-3">
                {vendorItems.map((item) => (
                  <CartItemRow key={item.product_id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
          <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Résumé</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Sous-total produits</span>
              <span className="font-medium text-[#1A1919]">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-primary-700">
              <span className="font-medium">Acompte à payer maintenant</span>
              <span className="font-medium">{formatPrice(deposit)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Solde à la livraison</span>
              <span>{formatPrice(remaining)}</span>
            </div>
            <div className="border-t border-primary-100 pt-3 flex justify-between">
              <span className="font-semibold text-[#1A1919]">Total</span>
              <span className="font-bold text-lg text-[#1A1919]">{formatPrice(subtotal)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/checkout"
              className="block w-full py-3 px-4 rounded-lg bg-primary-900 text-white text-center font-medium hover:bg-primary-800 transition-colors"
            >
              Passer la commande
            </Link>
            <Link
              href="/products"
              className="block w-full py-3 px-4 rounded-lg border border-primary-200 text-primary-900 text-center font-medium hover:bg-primary-50 transition-colors"
            >
              Continuer les achats
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
