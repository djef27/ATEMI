'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/components/toast-provider';
import { formatPrice } from '@/lib/utils';
import { ShoppingBag, ShoppingCart, Minus, Plus, Check } from 'lucide-react';

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
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const { showToast } = useToast();

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem({
        ...product,
        quantity: 1,
      });
    }
    setAdded(true);
    showToast(`${product.name} ajouté au panier`, 'success', <ShoppingCart className="w-5 h-5" />);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center border border-gray-300 rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="p-3 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            disabled={quantity <= 1}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-12 text-center font-medium text-gray-900">{quantity}</span>
          <button
            onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
            className="p-3 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            disabled={quantity >= product.stock}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <span className="text-sm text-gray-500">
          {quantity} × {formatPrice(product.selling_price)}
        </span>
      </div>

      <button
        onClick={handleAdd}
        className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
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
