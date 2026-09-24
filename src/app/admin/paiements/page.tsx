'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditCard, Loader2, CheckCircle } from 'lucide-react';
import type { Payment } from '@/types';
import { formatPrice } from '@/lib/utils';

interface OrderInfo {
  order_number: string;
  customer_name: string;
  customer_phone: string;
}

interface PaymentWithOrder extends Payment {
  orders?: OrderInfo;
}

export default function AdminPaiementsPage() {
  const [payments, setPayments] = useState<PaymentWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchPayments = async () => {
      const { data } = await supabase
        .from('payments')
        .select(`
          *,
          orders ( order_number, customer_name, customer_phone )
        `)
        .eq('payment_type', 'deposit')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setPayments((data as PaymentWithOrder[]) || []);
      setLoading(false);
    };

    fetchPayments();
  }, [supabase]);

  const handleConfirm = async (paymentId: string) => {
    setConfirmingId(paymentId);
    setError(null);

    try {
      const response = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          payment_method: 'admin_manual',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      } else {
        setError(result.error || 'Erreur lors de la confirmation');
      }
    } catch {
      setError('Erreur de connexion lors de la confirmation');
    } finally {
      setConfirmingId(null);
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Paiements en attente</h1>
        <span className="text-sm text-gray-500">{payments.length} en attente</span>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary-100 shadow-sm">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucun paiement en attente</h2>
          <p className="text-sm text-gray-500">Tous les paiements ont été traités.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const order = payment.orders;
            return (
              <div key={payment.id} className="bg-white rounded-2xl border border-primary-100 shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {order?.order_number || '—'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {order?.customer_name || '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {order?.customer_phone}
                    </p>
                    <p className="text-xs text-gray-500">
                      Réf: {payment.transaction_reference || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {payment.provider || '—'} · {payment.payment_method || '—'} · {payment.country || '—'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-primary-600">{formatPrice(payment.amount)}</p>
                    <button
                      onClick={() => handleConfirm(payment.id)}
                      disabled={confirmingId === payment.id}
                      className="mt-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      {confirmingId === payment.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Confirmer
                    </button>
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
