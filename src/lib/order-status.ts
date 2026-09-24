import type { OrderStatus } from '@/types';

export const ADMIN_UPDATEABLE_STATUSES: OrderStatus[] = [
  'confirmed',
  'vendor_processing',
  'ready_for_delivery',
  'assigned_to_driver',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
];

export const VENDOR_UPDATEABLE_STATUSES: OrderStatus[] = [
  'vendor_processing',
  'ready_for_delivery',
];

export const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'failed', 'completed'];

export function isOrderStatusTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}