'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Package, ShoppingCart, TrendingUp, Loader2, ChevronRight, Activity } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/types';

interface VendorStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}

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

export default function VendorDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!vendor) {
        setLoading(false);
        return;
      }

      const [productsResult, ordersResult, recentResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, status', { count: 'exact' })
          .eq('vendor_id', vendor.id),
        supabase
          .from('orders')
          .select('id, status, deposit_amount', { count: 'exact' })
          .eq('vendor_id', vendor.id),
        supabase
          .from('orders')
          .select('id, order_number, customer_name, status, total_amount, created_at')
          .eq('vendor_id', vendor.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const products = productsResult.data || [];
      const orders = ordersResult.data || [];

      setStats({
        totalProducts: products.length,
        activeProducts: products.filter((p) => p.status === 'active').length,
        totalOrders: orders.length,
        pendingOrders: orders.filter((o) => o.status === 'pending_payment' || o.status === 'confirmed').length,
        totalRevenue: orders
          .filter((o) => o.status !== 'cancelled')
          .reduce((sum, o) => sum + (Number(o.deposit_amount) || 0), 0),
      });
      setRecentOrders((recentResult.data as Order[]) || []);
      setLoading(false);
    };

    fetchStats();
  }, [user, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-sm text-gray-500">Produits</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalProducts || 0}</p>
          <p className="text-xs text-gray-500 mt-1">{stats?.activeProducts || 0} actifs</p>
        </div>

        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-sm text-gray-500">Commandes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalOrders || 0}</p>
          <p className="text-xs text-gray-500 mt-1">{stats?.pendingOrders || 0} en attente</p>
        </div>

        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm text-gray-500">Acomptes reçus</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(stats?.totalRevenue || 0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600" />
            Activité récente
          </h2>
          <Link
            href="/vendor/commandes"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-900"
          >
            Voir tout <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune commande récente pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentOrders.map((order) => {
              const color = statusColors[order.status] || statusColors.pending_payment;
              return (
                <li key={order.id}>
                  <Link
                    href="/vendor/commandes"
                    className="flex items-center justify-between gap-4 py-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-gray-900">
                        {order.order_number}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {order.customer_name} · {formatPrice(order.total_amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
