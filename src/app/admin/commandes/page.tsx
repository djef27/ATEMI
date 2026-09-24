'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCart, Loader2, ChevronDown, ChevronUp, Package } from 'lucide-react';
import type { Order, OrderItem, Payment, OrderStatusHistory, OrderStatus } from '@/types';
import { formatPrice } from '@/lib/utils';
import OrderStatusSelect from '@/components/order-status-select';
import { ADMIN_UPDATEABLE_STATUSES } from '@/lib/order-status';

const statusColors: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  vendor_processing: 'bg-blue-100 text-blue-700',
  ready_for_delivery: 'bg-blue-100 text-blue-700',
  assigned_to_driver: 'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

interface OrderDetail {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  status_history: OrderStatusHistory[];
  delivery_zone_name: string | null;
}

export default function AdminCommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [details, setDetails] = useState<Record<string, OrderDetail>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    setOrders((data as Order[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const loadDetail = async (orderId: string) => {
    if (openId === orderId) {
      setOpenId(null);
      return;
    }
    setOpenId(orderId);
    if (details[orderId]) return;

    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDetails((prev) => ({ ...prev, [orderId]: data.data }));
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleChanged = () => {
    fetchOrders();
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
        <span className="text-sm text-gray-500">{orders.length} commande{orders.length > 1 ? 's' : ''}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucune commande</h2>
          <p className="text-sm text-gray-500">Aucune commande pour le moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100">
                  <th className="text-left px-4 py-3 font-medium text-primary-500">N°</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Acompte</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-500"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const color = statusColors[order.status] || statusColors.pending_payment;
                  const isOpen = openId === order.id;
                  const detail = details[order.id];
                  return (
                    <Fragment key={order.id}>
                      <tr className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                          {order.order_number}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {order.customer_name}
                          <div className="text-xs text-gray-400">{order.customer_phone}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatPrice(order.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-primary-600 font-medium">
                          {formatPrice(order.deposit_amount)}
                        </td>
                        <td className="px-4 py-3">
                          {ADMIN_UPDATEABLE_STATUSES.includes(order.status) ? (
                            <OrderStatusSelect
                              orderId={order.id}
                              value={order.status}
                              statuses={ADMIN_UPDATEABLE_STATUSES}
                              endpoint="/api/admin/orders"
                              onChanged={handleChanged}
                            />
                          ) : (
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                              {order.status === 'pending_payment' ? 'En attente' : order.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(order.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => loadDetail(order.id)}
                            className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900 text-xs font-medium"
                          >
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            Détails
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${order.id}-detail`} className="border-b border-gray-50 bg-primary-50/40">
                          <td colSpan={7} className="px-4 py-4">
                            {detailLoading && !detail ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                              </div>
                            ) : detail ? (
                              <OrderDetailPanel detail={detail} />
                            ) : (
                              <p className="text-sm text-gray-500 py-2">Impossible de charger le détail.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderDetailPanel({ detail }: { detail: OrderDetail }) {
  const { order, items, payments, status_history, delivery_zone_name } = detail;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" /> Articles ({items.length})
          </h3>
          <div className="bg-white rounded-xl border border-primary-100 divide-y divide-gray-50">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} × {formatPrice(item.unit_price)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-medium text-gray-900">{formatPrice(item.line_total)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-primary-50/60">
              <span className="font-medium text-gray-700">Livraison</span>
              <span className="font-medium text-gray-900">{formatPrice(order.delivery_fee)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-semibold text-primary-900">{formatPrice(order.total_amount)}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Paiements</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun paiement enregistré.</p>
          ) : (
            <div className="bg-white rounded-xl border border-primary-100 divide-y divide-gray-50">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {p.payment_type === 'deposit' ? 'Acompte' : p.payment_type}
                    </p>
                    <p className="text-xs text-gray-500 font-mono truncate">{p.transaction_reference || '—'}</p>
                    <p className="text-xs text-gray-500">Provider: {p.provider || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium text-gray-900">{formatPrice(p.amount)}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Livraison</h3>
          <div className="bg-white rounded-xl border border-primary-100 p-4 text-sm space-y-2">
            <p className="text-gray-700">{order.delivery_address || 'Adresse non renseignée'}</p>
            <p className="text-gray-500">
              {[order.delivery_city, delivery_zone_name].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-gray-500">Solde à la livraison : <span className="font-medium text-gray-900">{formatPrice(order.delivery_balance)}</span></p>
            {order.customer_notes && (
              <p className="text-gray-600 italic">« {order.customer_notes} »</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique des statuts</h3>
          {status_history.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun historique.</p>
          ) : (
            <div className="bg-white rounded-xl border border-primary-100 divide-y divide-gray-50">
              {status_history.map((h) => (
                <div key={h.id} className="px-4 py-2.5 text-sm">
                  <p className="font-medium text-gray-900 capitalize">
                    {h.new_status.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(h.created_at).toLocaleString('fr-FR')}
                  </p>
                  {h.note && <p className="text-xs text-gray-600 mt-1">{h.note}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}