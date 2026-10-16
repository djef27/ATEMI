'use client';

import { useCart } from '@/hooks/use-cart';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type { CartItem } from '@/types';
import { formatPrice } from '@/lib/utils';

interface CartItemRowProps {
  item: CartItem;
}

export default function CartItemRow({ item }: CartItemRowProps) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4">
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-1">
          {item.name}
        </h3>
        {item.vendor_name && (
          <p className="text-xs text-gray-500 mt-0.5">{item.vendor_name}</p>
        )}
        <p className="text-sm font-medium text-primary-600 mt-1">
          {formatPrice(item.selling_price)}
        </p>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center border border-gray-200 rounded-lg">
            <button
              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
              className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-md"
              disabled={item.quantity <= 1}
              aria-label={`Diminuer la quantité de ${item.name}`}
            >
              <Minus className="w-3 h-3" aria-hidden="true" />
            </button>
            <span className="w-8 text-center text-sm font-medium text-gray-900" aria-live="polite">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
              className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-md"
              disabled={item.quantity >= item.stock}
              aria-label={`Augmenter la quantité de ${item.name}`}
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">
              {formatPrice(item.selling_price * item.quantity)}
            </span>
            <button
              onClick={() => removeItem(item.product_id)}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-md"
              aria-label={`Retirer ${item.name} du panier`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
