import { useCart } from '../cart';
import type { CartItem } from '@/types';

const mockItem: CartItem = {
  product_id: 'prod-1',
  name: 'Test Product',
  slug: 'test-product',
  image: null,
  selling_price: 10000,
  supplier_price: 5000,
  deposit_rate: 50,
  deposit_amount: 5000,
  remaining_amount: 5000,
  quantity: 1,
  stock: 10,
  vendor_id: 'vendor-1',
  vendor_name: 'Test Vendor',
};

const mockItem2: CartItem = {
  product_id: 'prod-2',
  name: 'Test Product 2',
  slug: 'test-product-2',
  image: null,
  selling_price: 20000,
  supplier_price: 10000,
  deposit_rate: 50,
  deposit_amount: 10000,
  remaining_amount: 10000,
  quantity: 2,
  stock: 5,
  vendor_id: 'vendor-1',
  vendor_name: 'Test Vendor',
};

beforeEach(() => {
  useCart.getState().clearCart();
});

describe('Cart Store', () => {
  describe('addItem', () => {
    it('adds a new item to the cart', () => {
      useCart.getState().addItem(mockItem);
      const items = useCart.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].product_id).toBe('prod-1');
      expect(items[0].quantity).toBe(1);
    });

    it('increases quantity when adding existing item', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().addItem({ ...mockItem, quantity: 2 });
      const items = useCart.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(3);
    });

    it('caps quantity at stock when adding existing item', () => {
      useCart.getState().addItem({ ...mockItem, quantity: 8 });
      useCart.getState().addItem({ ...mockItem, quantity: 5 });
      const items = useCart.getState().items;
      expect(items[0].quantity).toBe(10);
    });
  });

  describe('removeItem', () => {
    it('removes an item from the cart', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().removeItem('prod-1');
      expect(useCart.getState().items).toHaveLength(0);
    });

    it('does not affect other items', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().addItem(mockItem2);
      useCart.getState().removeItem('prod-1');
      expect(useCart.getState().items).toHaveLength(1);
      expect(useCart.getState().items[0].product_id).toBe('prod-2');
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity for a specific item', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().updateQuantity('prod-1', 5);
      expect(useCart.getState().items[0].quantity).toBe(5);
    });

    it('clamps quantity to minimum of 1', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().updateQuantity('prod-1', 0);
      expect(useCart.getState().items[0].quantity).toBe(1);
    });

    it('clamps quantity to maximum of stock', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().updateQuantity('prod-1', 100);
      expect(useCart.getState().items[0].quantity).toBe(10);
    });
  });

  describe('getSubtotal', () => {
    it('calculates subtotal for a single item', () => {
      useCart.getState().addItem(mockItem);
      expect(useCart.getState().getSubtotal()).toBe(10000);
    });

    it('calculates subtotal for multiple items', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().addItem(mockItem2);
      expect(useCart.getState().getSubtotal()).toBe(50000);
    });

    it('returns 0 for empty cart', () => {
      expect(useCart.getState().getSubtotal()).toBe(0);
    });
  });

  describe('getDeposit', () => {
    it('calculates deposit for a single item', () => {
      useCart.getState().addItem(mockItem);
      expect(useCart.getState().getDeposit()).toBe(5000);
    });

    it('calculates deposit for multiple items', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().addItem(mockItem2);
      expect(useCart.getState().getDeposit()).toBe(25000);
    });
  });

  describe('getRemaining', () => {
    it('calculates remaining for a single item', () => {
      useCart.getState().addItem(mockItem);
      expect(useCart.getState().getRemaining()).toBe(5000);
    });

    it('calculates remaining for multiple items', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().addItem(mockItem2);
      expect(useCart.getState().getRemaining()).toBe(25000);
    });
  });

  describe('getItemCount', () => {
    it('counts items correctly', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().addItem(mockItem2);
      expect(useCart.getState().getItemCount()).toBe(3);
    });

    it('returns 0 for empty cart', () => {
      expect(useCart.getState().getItemCount()).toBe(0);
    });
  });

  describe('getVendorId', () => {
    it('returns vendor_id of first item', () => {
      useCart.getState().addItem(mockItem);
      expect(useCart.getState().getVendorId()).toBe('vendor-1');
    });

    it('returns null for empty cart', () => {
      expect(useCart.getState().getVendorId()).toBeNull();
    });
  });

  describe('clearCart', () => {
    it('empties the cart', () => {
      useCart.getState().addItem(mockItem);
      useCart.getState().addItem(mockItem2);
      useCart.getState().clearCart();
      expect(useCart.getState().items).toHaveLength(0);
    });
  });

  describe('price consistency', () => {
    it('deposit + remaining equals selling_price for each item', () => {
      useCart.getState().addItem(mockItem);
      const item = useCart.getState().items[0];
      expect(item.deposit_amount + item.remaining_amount).toBe(item.selling_price);
    });

    it('subtotal equals sum of selling_price * quantity', () => {
      useCart.getState().addItem({ ...mockItem, quantity: 3 });
      useCart.getState().addItem({ ...mockItem2, quantity: 2 });
      const subtotal = useCart.getState().getSubtotal();
      expect(subtotal).toBe(10000 * 3 + 20000 * 2);
    });
  });
});
