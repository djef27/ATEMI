'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Package, Clock, CheckCircle, Truck, XCircle } from 'lucide-react';
import type { Order, OrderItem } from '@/types';
import { formatPrice } from '@/lib/utils';

const statusLabels: Record<string, { label: string; color: string; icon: typeof Package }> = {
  pending_payment: { label: 'En attente de paiement', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  vendor_processing: { label: 'En préparation', color: 'bg-blue-100 text-blue-700', icon: Package },
  ready_for_delivery: { label: 'Prête pour livraison', color: 'bg-blue-100 text-blue-700', icon: Package },
  assigned_to_driver: { label: 'Assignée au livreur', color: 'bg-purple-100 text-purple-700', icon: Truck },
  out_for_delivery: { label: 'En cours de livraison', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  completed: { label: 'Terminée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: XCircle },
  failed: { label: 'Échouée', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/mes-commandes');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !orderId) return;

    const fetchOrder = async () => {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('customer_id', user.id)
        .single();

      if (orderError || !orderData) {
        setLoading(false);
        return;
      }

      setOrder(orderData as Order);

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at');

      setItems((itemsData as OrderItem[]) || []);
      setLoading(false);
    };

    fetchOrder();
  }, [user, orderId, supabase]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </main>
    );
  }

  if (!user) return null;

  if (!order) {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-4">Commande introuvable</h1>
          <Link href="/mes-commandes" className="text-primary-600 hover:text-primary-500 font-medium">
            Retour à mes commandes
          </Link>
        </div>
      </main>
    );
  }

  const status = statusLabels[order.status] || statusLabels.pending_payment;
  const StatusIcon = status.icon;

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/mes-commandes"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1A1919] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à mes commandes
        </Link>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1919] font-serif">
              Commande {order.order_number}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(order.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.color}`}>
            <StatusIcon className="w-4 h-4" />
            {status.label}
          </span>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-6">
          <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Articles</h2>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{item.product_name}</p>
                  <p className="text-xs text-gray-500">Quantité : {item.quantity}</p>
                </div>
                <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                  {formatPrice(item.line_total)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-6">
          <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Résumé</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Sous-total</span>
              <span className="font-medium text-[#1A1919]">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Livraison</span>
              <span className="font-medium text-[#1A1919]">{formatPrice(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[#1A1919]">Total</span>
              <span className="text-[#1A1919]">{formatPrice(order.total_amount)}</span>
            </div>
            <div className="border-t border-primary-100 pt-3 flex justify-between text-primary-700">
              <span className="font-medium">Acompte payé</span>
              <span className="font-bold">{formatPrice(order.deposit_amount)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Solde à la livraison</span>
              <span>{formatPrice(order.delivery_balance)}</span>
            </div>
          </div>
        </div>

        {/* Delivery info */}
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-6">
          <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Livraison</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Adresse : </span>
              <span className="text-gray-900">{order.delivery_address}</span>
            </div>
            <div>
              <span className="text-gray-500">Ville : </span>
              <span className="text-gray-900">{order.delivery_city}</span>
            </div>
            {order.customer_notes && (
              <div>
                <span className="text-gray-500">Notes : </span>
                <span className="text-gray-900">{order.customer_notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tracking */}
        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6">
          <h2 className="font-serif text-lg font-semibold text-[#1A1919] mb-4">Suivi</h2>
          <p className="text-sm text-gray-600 mb-3">
            Utilisez votre numéro de commande et email pour suivre l&apos;état de votre commande.
          </p>
          <Link
            href={`/suivi?order=${order.order_number}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
          >
            Suivre ma commande
          </Link>
        </div>
      </div>
    </main>
  );
}
