'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { ShoppingCart, Loader2 } from 'lucide-react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/utils';
import OrderStatusSelect from '@/components/order-status-select';
import { VENDOR_UPDATEABLE_STATUSES, canVendorUpdateStatus, getOrderStatusMeta } from '@/lib/order-status';
import type { OrderStatus } from '@/types';

type VendorOrderTotals = {
  quantity: number;
  subtotal: number;
  deposit: number;
  remaining: number;
};

export default function VendorCommandesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [totals, setTotals] = useState<Record<string, VendorOrderTotals>>({});
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchOrders = useCallback(async (vendorId: string) => {
    // Les lignes de commande (order_items) portent le vendor_id réel, y compris
    // pour les commandes multi-vendeurs et les commandes antérieures au
    // backfill de orders.vendor_id : on s'appuie donc dessus, et non sur
    // orders.vendor_id qui peut être NULL.
    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id, quantity, line_total, deposit_amount_snapshot, remaining_amount_snapshot')
      .eq('vendor_id', vendorId);

    if (itemsError) {
      console.error('[VENDOR_ORDERS]', itemsError.message);
      setOrders([]);
      setTotals({});
      setLoading(false);
      return;
    }

    // Agrégation par commande : un vendeur ne doit jamais voir les montants
    // d'un autre vendeur sur une commande multi-vendeurs.
    const byOrder: Record<string, VendorOrderTotals> = {};
    for (const row of itemRows || []) {
      if (!row.order_id) continue;
      const current = byOrder[row.order_id] || {
        quantity: 0,
        subtotal: 0,
        deposit: 0,
        remaining: 0,
      };
      current.quantity += row.quantity ?? 0;
      current.subtotal += Number(row.line_total ?? 0);
      current.deposit += Number(row.deposit_amount_snapshot ?? 0);
      current.remaining += Number(row.remaining_amount_snapshot ?? 0);
      byOrder[row.order_id] = current;
    }
    setTotals(byOrder);

    const orderIds = Object.keys(byOrder);
    if (orderIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // Explicit column list: a vendor must never receive customer_email,
    // customer_notes, customer_whatsapp, tracking_token or vendor_id for an
    // order they only partly own (multi-vendor baskets).
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, customer_name, created_at')
      .in('id', orderIds)
      .order('created_at', { ascending: false });

    if (error) console.error('[VENDOR_ORDERS]', error.message);

    setOrders((data as Order[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!vendor) {
        setLoading(false);
        return;
      }

      setVendorId(vendor.id);
      fetchOrders(vendor.id);
    };

    init();
  }, [user, supabase, fetchOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mes commandes</h1>
        <span className="text-sm text-gray-500">{orders.length} commande{orders.length > 1 ? 's' : ''}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucune commande</h2>
          <p className="text-sm text-gray-500">Vous n&apos;avez pas encore de commandes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = getOrderStatusMeta(order.status);
            const vendorUpdatable = canVendorUpdateStatus(order.status as OrderStatus);
            const own = totals[order.id] || {
              quantity: 0,
              subtotal: 0,
              deposit: 0,
              remaining: 0,
            };
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-primary-100 shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {order.order_number}
                      </span>
                      {vendorUpdatable && vendorId ? (
                        <OrderStatusSelect
                          orderId={order.id}
                          value={order.status}
                          statuses={VENDOR_UPDATEABLE_STATUSES}
                          endpoint="/api/vendor/orders"
                          onChanged={() => fetchOrders(vendorId)}
                        />
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {own.quantity} article{own.quantity > 1 ? 's' : ''} ·{' '}
                      {new Date(order.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{formatPrice(own.subtotal)}</p>
                    <p className="text-xs text-primary-600">Acompte: {formatPrice(own.deposit)}</p>
                    <p className="text-xs text-gray-500">Solde: {formatPrice(own.remaining)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
