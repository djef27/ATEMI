// ============================================
// Database Types — Matches remote Supabase schema
// ============================================

export type UserRole = 'admin' | 'vendor' | 'customer' | 'driver';

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'vendor_processing'
  | 'ready_for_delivery'
  | 'assigned_to_driver'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PaymentType = 'deposit' | 'delivery_balance' | 'refund';

export type DeliveryMethod = 'delivery' | 'pickup';

export type ProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock';

export type VendorStatus = 'pending' | 'active' | 'suspended' | 'inactive';

export type DeliveryStatus =
  | 'pending'
  | 'accepted'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type NotificationChannel = 'whatsapp' | 'email' | 'dashboard' | 'system';

export type NotificationType = string; // TEXT column in production, not an enum

export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'delivered';

// ============================================
// Table Types
// ============================================

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  city: string;
  country: string;
  status: VendorStatus;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  profile_id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  supplier_price: number;
  selling_price: number;
  deposit_rate: number;
  deposit_amount: number;
  remaining_amount: number;
  stock: number;
  status: ProductStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  media_type: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  tracking_token: string;
  customer_id: string | null;
  vendor_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp: string | null;
  customer_email: string | null;
  delivery_address: string;
  delivery_city: string;
  delivery_zone_id: string | null;
  delivery_required: boolean;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  deposit_amount: number;
  delivery_balance: number;
  receipt_number: string | null;
  status: OrderStatus;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  vendor_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  deposit_rate_snapshot: number | null;
  deposit_amount_snapshot: number | null;
  remaining_amount_snapshot: number | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  provider_transaction_id: string | null;
  country: string | null;
  payment_method: string | null;
  transaction_reference: string | null;
  payment_url: string | null;
  paid_at: string | null;
  webhook_received_at: string | null;
  verified_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface DeliveryZone {
  id: string;
  country: string;
  city: string;
  zone_name: string;
  delivery_fee: number;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_id: string | null;
  status: DeliveryStatus;
  accepted_at: string | null;
  picked_up_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  order_id: string | null;
  recipient_profile_id: string | null;
  recipient_vendor_id: string | null;
  recipient_driver_id: string | null;
  recipient_phone: string | null;
  channel: NotificationChannel;
  notification_type: NotificationType;
  status: NotificationStatus;
  message: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ============================================
// Supabase Database type
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, 'id'>; Update: Partial<Profile> };
      vendors: { Row: Vendor; Insert: Partial<Vendor> & Pick<Vendor, 'name'>; Update: Partial<Vendor> };
      drivers: { Row: Driver; Insert: Partial<Driver> & Pick<Driver, 'name' | 'phone' | 'profile_id'>; Update: Partial<Driver> };
      categories: { Row: Category; Insert: Partial<Category> & Pick<Category, 'name'>; Update: Partial<Category> };
      products: { Row: Product; Insert: Partial<Product> & Pick<Product, 'vendor_id' | 'name' | 'selling_price' | 'deposit_amount' | 'remaining_amount'>; Update: Partial<Product> };
      product_images: { Row: ProductImage; Insert: Partial<ProductImage> & Pick<ProductImage, 'product_id' | 'image_url'>; Update: Partial<ProductImage> };
      orders: { Row: Order; Insert: Partial<Order> & Pick<Order, 'order_number' | 'customer_name' | 'customer_phone' | 'delivery_address' | 'subtotal' | 'total_amount' | 'deposit_amount'>; Update: Partial<Order> };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem> & Pick<OrderItem, 'order_id' | 'product_id' | 'vendor_id' | 'product_name' | 'unit_price' | 'quantity' | 'line_total'>; Update: Partial<OrderItem> };
      payments: { Row: Payment; Insert: Partial<Payment> & Pick<Payment, 'order_id' | 'amount' | 'payment_type'>; Update: Partial<Payment> };
      order_status_history: { Row: OrderStatusHistory; Insert: Partial<OrderStatusHistory> & Pick<OrderStatusHistory, 'order_id' | 'new_status'>; Update: Partial<OrderStatusHistory> };
      delivery_zones: { Row: DeliveryZone; Insert: Partial<DeliveryZone> & Pick<DeliveryZone, 'city' | 'zone_name' | 'delivery_fee'>; Update: Partial<DeliveryZone> };
      deliveries: { Row: Delivery; Insert: Partial<Delivery> & Pick<Delivery, 'order_id'>; Update: Partial<Delivery> };
      notifications: { Row: Notification; Insert: Partial<Notification> & Pick<Notification, 'notification_type' | 'message'>; Update: Partial<Notification> };
      settings: { Row: Setting; Insert: Partial<Setting> & Pick<Setting, 'key' | 'value'>; Update: Partial<Setting> };
      audit_log: { Row: AuditLog; Insert: Partial<AuditLog> & Pick<AuditLog, 'action' | 'entity_type'>; Update: Partial<AuditLog> };
    };
    Functions: {
      get_my_role: { Args: never; Returns: UserRole };
      is_admin: { Args: never; Returns: boolean };
      is_vendor: { Args: never; Returns: boolean };
      is_driver: { Args: never; Returns: boolean };
      get_my_vendor_id: { Args: never; Returns: string | null };
      get_my_driver_id: { Args: never; Returns: string | null };
      create_order: {
        Args: {
          p_customer_id?: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_customer_whatsapp?: string;
          p_delivery_address: string;
          p_delivery_city: string;
          p_delivery_zone_id?: string;
          p_delivery_required?: boolean;
          p_customer_notes?: string;
          p_customer_email?: string;
          p_provider?: string;
        };
        Returns: {
          success: boolean;
          order_id: string;
          order_number: string;
          tracking_token: string;
          subtotal: number;
          delivery_fee: number;
          total_amount: number;
          deposit_amount: number;
          delivery_balance: number;
          payment_status: string;
          order_status: string;
        };
      };
      get_order_by_email: {
        Args: { p_order_number: string; p_email: string };
        Returns: Record<string, unknown> | null;
      };
      confirm_deposit_payment: {
        Args: {
          p_payment_id: string;
          p_transaction_reference?: string;
          p_payment_method?: string;
        };
        Returns: {
          success: boolean;
          already_processed: boolean;
          message: string;
          payment_id: string;
          order_id: string;
          order_number: string;
          payment_status: string;
          order_status: string;
          deposit_amount: number;
          delivery_balance: number;
          delivery_fee: number;
          notifications_created: number;
        };
      };
      get_order_receipt: {
        Args: { p_order_number: string; p_tracking_token: string };
        Returns: Record<string, unknown> | null;
      };
      get_order_tracking: {
        Args: { p_order_number: string; p_tracking_token: string };
        Returns: Record<string, unknown> | null;
      };
      claim_pending_whatsapp_notifications: {
        Args: { p_limit?: number };
        Returns: unknown[];
      };
    };
  };
}
