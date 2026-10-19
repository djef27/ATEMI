'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Printer, CreditCard, Package, Truck, CheckCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';

interface Receipt {
  order_number: string;
  receipt_number: string | null;
  date: string;
  status: string;
  customer: { name: string; phone: string };
  items: Array<{ product_name: string; quantity: number; unit_price: number; line_total: number }>;
  amounts: { subtotal: number; delivery_fee: number; total: number; paid: number; remaining: number };
  delivery: { required: boolean; city: string; address: string };
}

interface OrderTracking {
  status: string;
  items: Receipt['items'];
}

const statusLabels: Record<string, string> = {
  confirmed: 'Commande confirmée',
  vendor_processing: 'Préparation en cours',
  ready_for_delivery: 'Prête pour livraison',
  out_for_delivery: 'En cours de livraison',
  delivered: 'Livrée',
};

export default function RecuPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const handleSearch = useCallback(async (
    e: React.FormEvent,
    lookupOrderNumber = orderNumber,
    lookupTrackingToken = trackingToken
  ) => {
    e.preventDefault();
    setError(null);
    setReceipt(null);
    setTracking(null);
    setLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_order_receipt', {
        p_order_number: lookupOrderNumber.trim(),
        p_tracking_token: lookupTrackingToken.trim(),
      });

      if (rpcError || !data || !data.success || !data.receipt) {
        setError('Reçu non trouvé. Vérifiez vos informations.');
        setLoading(false);
        return;
      }

      // SECURITY: Only show receipt for paid orders
      const receipt = data.receipt as Receipt;
      if (receipt.status !== 'paid' && receipt.status !== 'confirmed') {
        setError('Acompte non payé. Le reçu est généré uniquement après confirmation du paiement de l\'acompte.');
        setPaymentLink(`/paiement?order=${lookupOrderNumber.trim()}&token=${lookupTrackingToken.trim()}`);
        setLoading(false);
        return;
      }

      // Additional security: verify paid amount > 0
      if (receipt.amounts.paid <= 0) {
        setError('Aucun paiement enregistré. Le reçu est disponible uniquement après le paiement de l\'acompte.');
        setPaymentLink(`/paiement?order=${lookupOrderNumber.trim()}&token=${lookupTrackingToken.trim()}`);
        setLoading(false);
        return;
      }

      setPaymentLink(null);

      setReceipt(receipt);

      const { data: trackingData } = await supabase.rpc('get_order_tracking', {
        p_order_number: lookupOrderNumber.trim(),
        p_tracking_token: lookupTrackingToken.trim(),
      });
      if (trackingData?.success && trackingData.order) {
        setTracking(trackingData.order as OrderTracking);
      }
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, [supabase, orderNumber, trackingToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    const tokenParam = params.get('token');
    if (!orderParam || !tokenParam) return;

    setOrderNumber(orderParam);
    setTrackingToken(tokenParam);
    // orderParam/tokenParam are locally derived from the URL — not reactive deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    void handleSearch({
      preventDefault: () => undefined,
    } as React.FormEvent, orderParam, tokenParam);
  }, [handleSearch]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-8">Mon reçu</h1>

        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-8 print:hidden">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de commande
              </label>
              <input
                id="orderNumber"
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="CMD-20260827-…"
                className="w-full px-4 py-3 rounded-lg border border-primary-200 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:border-transparent font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor="trackingToken" className="block text-sm font-medium text-gray-700 mb-1">
                Token de suivi (UUID)
              </label>
              <input
                id="trackingToken"
                type="text"
                value={trackingToken}
                onChange={(e) => setTrackingToken(e.target.value)}
                placeholder="UUID de suivi"
                className="w-full px-4 py-3 rounded-lg border border-primary-200 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:border-transparent font-mono text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !orderNumber.trim() || !trackingToken.trim()}
                className="flex-1 py-3 px-4 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Recherche…' : 'Voir le reçu'}
              </button>
              {receipt && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-3 rounded-lg border border-primary-200 text-gray-700 font-medium hover:bg-[#FAFAF8] transition-colors flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
              )}
            </div>
          </form>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-6 print:hidden">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-600 font-bold text-sm">!</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold mb-1">Paiement requis</p>
                <p className="text-amber-700 mb-3">{error}</p>
                {paymentLink && (
                  <Link
                    href={paymentLink}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Payer l&apos;acompte maintenant
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {receipt && (
          <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-8" id="receipt">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-[#1A1919] font-serif">Atémi</h2>
              <p className="text-sm text-gray-500">Reçu de commande</p>
            </div>

            <div className="border-t border-b border-primary-100 py-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Numéro</span>
                  <p className="font-mono font-semibold text-gray-900">{receipt.receipt_number || receipt.order_number}</p>
                </div>
                <div>
                  <span className="text-gray-500">Statut</span>
                  <p className="font-medium">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      PAYÉ
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Client</span>
                  <p className="font-medium text-gray-900">{receipt.customer.name}</p>
                </div>

                <div>
                  <span className="text-gray-500">Téléphone</span>
                  <p className="font-medium text-gray-900">{receipt.customer.phone}</p>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-primary-100 bg-[#FAFAF8] p-4 print:hidden">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-primary-700" />
                <h3 className="text-sm font-semibold text-gray-900">Suivi de la commande</h3>
              </div>
              <p className="text-sm font-medium text-primary-800">
                {statusLabels[tracking?.status || receipt.status] || 'Commande confirmée'}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Payé</div>
                <div className="flex items-center gap-1"><Package className="w-3 h-3 text-primary-600" /> Préparation</div>
                <div className="flex items-center gap-1"><Truck className="w-3 h-3 text-primary-600" /> Livraison</div>
              </div>
            </div>

            {receipt.items && receipt.items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Articles</h3>
                <div className="space-y-2">
                  {receipt.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.product_name} × {item.quantity}
                      </span>
                      <span className="font-medium text-gray-900">{formatPrice(item.line_total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-primary-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium text-gray-900">{formatPrice(receipt.amounts.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Livraison</span>
                <span className="font-medium text-gray-900">{formatPrice(receipt.amounts.delivery_fee)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold border-t border-primary-100 pt-2">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">{formatPrice(receipt.amounts.total)}</span>
              </div>
              <div className="flex justify-between text-primary-600">
                <span className="font-medium">Acompte payé</span>
                <span className="font-semibold">{formatPrice(receipt.amounts.paid)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Solde restant</span>
                <span className="font-medium">{formatPrice(receipt.amounts.remaining)}</span>
              </div>
            </div>

            <div className="mt-8 border-t border-primary-100 pt-6 print:hidden">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Prochaines étapes</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">2. Préparation</p>
                  <p className="text-gray-600">Après confirmation du paiement.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">3. Livraison</p>
                  <p className="text-gray-600">À domicile ou selon convenu.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-xs text-gray-400">
              <p>Merci pour votre achat !</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
