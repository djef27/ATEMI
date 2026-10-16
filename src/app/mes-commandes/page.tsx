'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Loader2, ChevronRight } from 'lucide-react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/utils';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  vendor_processing: { label: 'En préparation', color: 'bg-blue-100 text-blue-700' },
  ready_for_delivery: { label: 'Prête', color: 'bg-blue-100 text-blue-700' },
  assigned_to_driver: { label: 'En livraison', color: 'bg-purple-100 text-purple-700' },
  out_for_delivery: { label: 'En cours', color: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
  failed: { label: 'Échouée', color: 'bg-red-100 text-red-700' },
};

export default function MesCommandesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/mes-commandes');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      setOrders((data as Order[]) || []);
      setLoading(false);
    };

    fetchOrders();
  }, [user, supabase]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-8">Mes commandes</h1>

        {orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#1A1919] font-serif mb-2">Aucune commande</h2>
            <p className="text-sm text-gray-500">Vous n&apos;avez pas encore passé de commande.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const status = statusLabels[order.status] || statusLabels.pending_payment;
              return (
                <Link
                  key={order.id}
                  href={`/mes-commandes/${order.id}`}
                  className="block bg-white rounded-2xl border border-primary-100 shadow-sm p-4 sm:p-5 hover:shadow-md hover:border-primary-200 transition-[box-shadow,border-color]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {order.order_number}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(order.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{formatPrice(order.total_amount)}</p>
                        <p className="text-xs text-primary-600">Acompte: {formatPrice(order.deposit_amount)}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
