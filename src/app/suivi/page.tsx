'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Package, Clock, CheckCircle, Truck, XCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  pending_payment: 'En attente de paiement',
  confirmed: 'Confirmée',
  vendor_processing: 'En préparation',
  ready_for_delivery: 'Prête pour livraison',
  out_for_delivery: 'En cours de livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  failed: 'Échouée',
};

interface TrackingOrder {
  order_number: string;
  customer_name: string;
  status: string;
  total_amount: number;
  deposit_amount: number;
  delivery_balance: number;
  delivery_city: string;
  delivery_address: string;
  delivery_required: boolean;
  created_at: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

interface EmailLookupResult {
  found: boolean;
  order_number: string;
  tracking_token: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  deposit_amount: number;
  remaining_amount: number;
  currency: string;
  customer_first_name: string;
  customer_phone: string;
  city: string;
  created_at: string;
}

export default function SuiviPage() {
  const [mode, setMode] = useState<'token' | 'email'>('token');
  const [orderNumber, setOrderNumber] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [email, setEmail] = useState('');
  const [emailOrderNumber, setEmailOrderNumber] = useState('');
  const [order, setOrder] = useState<TrackingOrder | EmailLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const lookupByToken = useCallback(async (orderNum: string, token: string) => {
    setError(null);
    setOrder(null);
    setLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_order_tracking', {
        p_order_number: orderNum.trim(),
        p_tracking_token: token.trim(),
      });

      if (rpcError || !data || !data.success || !data.order) {
        setError('Commande non trouvée. Vérifiez votre numéro et token de suivi.');
        return;
      }

      setOrder(data.order as TrackingOrder);
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Auto-load from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    const tokenParam = params.get('token');
    if (orderParam && tokenParam) {
      setOrderNumber(orderParam);
      setTokenInput(tokenParam);
      setMode('token');
      lookupByToken(orderParam, tokenParam);
    }
  }, [lookupByToken]);

  const lookupByEmail = async (orderNum: string, emailAddr: string) => {
    setError(null);
    setOrder(null);
    setLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_order_by_email', {
        p_order_number: orderNum.trim(),
        p_email: emailAddr.trim(),
      });

      if (rpcError || !data || !data.found) {
        setError('Commande non trouvée. Vérifiez votre numéro de commande et adresse e-mail.');
        return;
      }

      setOrder(data as EmailLookupResult);
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await lookupByToken(orderNumber, tokenInput);
  };

  const handleEmailSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await lookupByEmail(emailOrderNumber, email);
  };

  const displayToken = mode === 'token' ? tokenInput : (order as EmailLookupResult)?.tracking_token;

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-8">Suivre ma commande</h1>

        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-8">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setMode('token')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'token'
                  ? 'bg-primary-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Token de suivi
            </button>
            <button
              type="button"
              onClick={() => setMode('email')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'email'
                  ? 'bg-primary-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Email + N° commande
            </button>
          </div>

          {mode === 'token' ? (
            <form onSubmit={handleTokenSearch} className="space-y-4">
              <div>
                <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de commande
                </label>
                <input
                  id="orderNumber"
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ATM-20260827-..."
                  className="w-full px-4 py-3 rounded-lg border border-primary-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent font-mono text-sm"
                />
              </div>
              <div>
                <label htmlFor="trackingToken" className="block text-sm font-medium text-gray-700 mb-1">
                  Token de suivi (UUID)
                </label>
                <input
                  id="trackingToken"
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="UUID de suivi"
                  className="w-full px-4 py-3 rounded-lg border border-primary-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent font-mono text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !orderNumber.trim() || !tokenInput.trim()}
                className="w-full py-3 px-4 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Recherche...' : 'Chercher'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSearch} className="space-y-4">
              <div>
                <label htmlFor="emailOrderNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de commande
                </label>
                <input
                  id="emailOrderNumber"
                  type="text"
                  value={emailOrderNumber}
                  onChange={(e) => setEmailOrderNumber(e.target.value)}
                  placeholder="ATM-20260827-..."
                  className="w-full px-4 py-3 rounded-lg border border-primary-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent font-mono text-sm"
                />
              </div>
              <div>
                <label htmlFor="emailLookup" className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse e-mail
                </label>
                <input
                  id="emailLookup"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="w-full px-4 py-3 rounded-lg border border-primary-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !emailOrderNumber.trim() || !email.trim()}
                className="w-full py-3 px-4 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Recherche...' : 'Chercher'}
              </button>
            </form>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {order && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#1A1919] font-serif">
                  Commande {order.order_number}
                </h2>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700">
                  {statusLabels[
                    ('status' in order ? order.status : null) ||
                    ('order_status' in order ? order.order_status : '') ||
                    ''
                  ] || ('status' in order ? order.status : '') || ('order_status' in order ? order.order_status : '')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Montant total</span>
                  <p className="font-semibold text-gray-900">{formatPrice(order.total_amount)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Acompte payé</span>
                  <p className="font-semibold text-green-600">{formatPrice(order.deposit_amount)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Solde restant</span>
                  <p className="font-medium text-gray-700">
                    {formatPrice(
                      'remaining_amount' in order
                        ? order.remaining_amount
                        : 'delivery_balance' in order
                          ? (order as TrackingOrder).delivery_balance
                          : 0
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Livraison</span>
                  <p className="font-medium text-gray-700">
                    {'delivery_required' in order
                      ? order.delivery_required
                        ? order.delivery_city
                        : 'Retrait'
                      : order.city || '-'}
                  </p>
                </div>
              </div>

              {'items' in order && order.items && order.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-primary-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Articles</h3>
                  <div className="space-y-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-gray-900">{item.product_name}</span>
                          <span className="text-gray-500 ml-2">x {item.quantity}</span>
                        </div>
                        <span className="font-medium text-gray-900">{formatPrice(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {displayToken && (
              <div className="bg-primary-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Votre token de suivi</p>
                <code className="text-sm font-mono text-gray-700 bg-white px-3 py-1.5 rounded-lg inline-block">
                  {displayToken}
                </code>
              </div>
            )}

            <div className="text-center text-xs text-gray-400">
              Passée le {new Date(order.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
