'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/components/toast-provider';
import { formatPrice } from '@/lib/utils';
import { ShoppingBag, ShoppingCart, Minus, Plus, Check } from 'lucide-react';
import { useId } from 'react';

interface AddToCartButtonProps {
  product: {
    product_id: string;
    name: string;
    slug: string;
    image: string | null;
    selling_price: number;
    supplier_price: number;
    deposit_rate: number;
    deposit_amount: number;
    remaining_amount: number;
    quantity: number;
    stock: number;
    vendor_id: string;
    vendor_name: string;
  };
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const quantityId = useId();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const { showToast } = useToast();

  const handleAdd = () => {
    addItem({ ...product, quantity });
    setAdded(true);
    showToast(`${product.name} ajouté au panier`, 'success', <ShoppingCart className="w-5 h-5" />);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div role="group" className="flex items-center border border-gray-300 rounded-lg" aria-label="Choisir la quantité">
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="p-3 text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
            disabled={quantity <= 1}
            aria-label="Diminuer la quantité"
            aria-controls={quantityId}
          >
            <Minus className="w-4 h-4" />
          </button>
          <output id={quantityId} className="w-12 text-center font-medium text-gray-900" aria-live="polite">
            {quantity}
          </output>
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
            className="p-3 text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
            disabled={quantity >= product.stock}
            aria-label="Augmenter la quantité"
            aria-controls={quantityId}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <span className="text-sm text-gray-500">
          {quantity} × {formatPrice(product.selling_price)}
        </span>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={product.stock <= 0}
        className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          added
            ? 'bg-green-600 text-white'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {added ? (
          <>
            <Check className="w-5 h-5" />
            Ajouté au panier
          </>
        ) : (
          <>
            <ShoppingBag className="w-5 h-5" />
            Ajouter au panier
          </>
        )}
      </button>
    </div>
  );
}
