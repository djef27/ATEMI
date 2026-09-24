'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { ShoppingCart, Loader2 } from 'lucide-react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/utils';
import OrderStatusSelect from '@/components/order-status-select';
import { VENDOR_UPDATEABLE_STATUSES, isOrderStatusTerminal } from '@/lib/order-status';
import type { OrderStatus } from '@/types';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  vendor_processing: { label: 'En préparation', color: 'bg-blue-100 text-blue-700' },
  ready_for_delivery: { label: 'Prête', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
  failed: { label: 'Échouée', color: 'bg-red-100 text-red-700' },
};

export default function VendorCommandesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchOrders = useCallback(async (vendorId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

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
            const status = statusLabels[order.status] || statusLabels.pending_payment;
            const vendorUpdatable =
              order.status !== 'pending_payment' &&
              !isOrderStatusTerminal(order.status as OrderStatus);
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-primary-100 shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {order.order_number}
                      </span>
                      {vendorUpdatable ? (
                        <OrderStatusSelect
                          orderId={order.id}
                          value={order.status}
                          statuses={VENDOR_UPDATEABLE_STATUSES}
                          endpoint="/api/vendor/orders"
                          onChanged={() => fetchOrders(String(order.vendor_id))}
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
                      {new Date(order.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{formatPrice(order.total_amount)}</p>
                    <p className="text-xs text-primary-600">Acompte: {formatPrice(order.deposit_amount)}</p>
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
