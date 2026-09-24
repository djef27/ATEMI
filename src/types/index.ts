// Re-export all types
export * from './database';

// ============================================
// Public types (safe for frontend)
// ============================================

import type { Product, Vendor, Category, Profile } from './database';

/** Product data safe to expose to clients (no supplier_price) */
export type PublicProduct = Omit<Product, 'supplier_price'> & {
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
  vendor_name?: string;
  image_url?: string | null;
};

/** Vendor data safe to expose publicly (no whatsapp, no phone) */
export type PublicVendor = Pick<Vendor, 'id' | 'name' | 'city' | 'country' | 'status'>;

/** Profile data safe for authenticated user */
export type PublicProfile = Pick<Profile, 'id' | 'phone' | 'full_name' | 'role'>;

// ============================================
// Cart types
// ============================================

export interface CartItem {
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
}

export interface Cart {
  items: CartItem[];
}

// ============================================
// Checkout types
// ============================================

export interface CheckoutData {
  customer_name: string;
  customer_phone: string;
  customer_whatsapp: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_zone_id: string | null;
  delivery_required: boolean;
  customer_notes: string | null;
  items: { product_id: string; quantity: number }[];
}

export interface OrderSummary {
  items: {
    product_id: string;
    name: string;
    unit_price: number;
    quantity: number;
    total: number;
  }[];
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  deposit_amount: number;
  remaining_amount: number;
  currency: string;
}

// ============================================
// API Response types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
