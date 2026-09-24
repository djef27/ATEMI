import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import type { CartItem } from '@/types';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getDeposit: () => number;
  getRemaining: () => number;
  getItemCount: () => number;
  getVendorId: () => string | null;
  _hasHydrated: boolean;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      _hasHydrated: false,

      addItem: (item) => {
        set((state) => {
          const existing = state.items.find((i) => i.product_id === item.product_id);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === item.product_id
                  ? { ...i, quantity: Math.min(i.stock, i.quantity + item.quantity) }
                  : i
              ),
            };
          }

          return { items: [...state.items, item] };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.product_id !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.product_id === productId
              ? { ...i, quantity: Math.max(1, Math.min(i.stock, quantity)) }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
      },

      getDeposit: () => {
        return get().items.reduce(
          (sum, item) => sum + Math.round(item.selling_price * (item.deposit_rate ?? 50) / 100) * item.quantity,
          0
        );
      },

      getRemaining: () => {
        return get().items.reduce((sum, item) => {
          return sum + item.remaining_amount * item.quantity;
        }, 0);
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getVendorId: () => {
        const items = get().items;
        if (items.length === 0) return null;
        return items[0].vendor_id;
      },
    }),
    {
      name: 'atemi-cart',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => {
        return () => {
          useCart.setState({ _hasHydrated: true });
        };
      },
    }
  )
);

/**
 * Hook that returns cart state only after hydration is complete.
 * Prevents SSR/client mismatch.
 */
export function useHydratedCart() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const items = useCart((s) => (hydrated ? s.items : []));
  const getItemCount = useCart((s) => s.getItemCount);

  return {
    items,
    itemCount: hydrated ? getItemCount() : 0,
    hydrated,
  };
}
