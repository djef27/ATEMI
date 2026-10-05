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

/**
 * Statuses a vendor may still act on. A vendor only moves an order *forward*
 * through its own two steps, so anything already handed over to a driver or
 * closed must be read-only — otherwise the status `<select>` renders with no
 * matching option and saving it rewinds the order.
 */
export const VENDOR_EDITABLE_CURRENT_STATUSES: OrderStatus[] = [
  'confirmed',
  'vendor_processing',
  'ready_for_delivery',
];

export const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'failed', 'completed'];

export function isOrderStatusTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canAdminUpdateStatus(status: OrderStatus): boolean {
  return !isOrderStatusTerminal(status) && ADMIN_UPDATEABLE_STATUSES.includes(status);
}

export function canVendorUpdateStatus(status: OrderStatus): boolean {
  return !isOrderStatusTerminal(status) && VENDOR_EDITABLE_CURRENT_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Presentation — single source of truth for every status label/badge.
// Previously duplicated (inconsistently) across ~10 files, which made a
// `completed` order render as "En attente" on some pages.
// ---------------------------------------------------------------------------

export interface OrderStatusMeta {
  label: string;
  color: string;
}

const FALLBACK_META: OrderStatusMeta = { label: 'Statut inconnu', color: 'bg-gray-100 text-gray-700' };

const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  pending_payment: { label: 'En attente de paiement', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  vendor_processing: { label: 'En préparation', color: 'bg-blue-100 text-blue-700' },
  ready_for_delivery: { label: 'Prête pour la livraison', color: 'bg-blue-100 text-blue-700' },
  assigned_to_driver: { label: 'Assignée à un livreur', color: 'bg-indigo-100 text-indigo-700' },
  out_for_delivery: { label: 'En cours de livraison', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Terminée', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
  failed: { label: 'Échouée', color: 'bg-red-100 text-red-700' },
};

export function getOrderStatusMeta(status: string | null | undefined): OrderStatusMeta {
  if (!status) return FALLBACK_META;
  return ORDER_STATUS_META[status] ?? FALLBACK_META;
}

export function getOrderStatusLabel(status: string | null | undefined): string {
  return getOrderStatusMeta(status).label;
}
