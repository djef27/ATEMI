'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type PaymentState = 'loading' | 'redirecting' | 'success' | 'pending_confirmation' | 'failed' | 'error' | 'not_found';

function PaiementForm() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const trackingToken = searchParams.get('token');
  const isProviderReturn = searchParams.get('return') === '1';
  const [paymentState, setPaymentState] = useState<PaymentState>('loading');
  const [error, setError] = useState<string | null>(null);
  const initiatedRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!orderNumber || !trackingToken) {
      setPaymentState('not_found');
      return;
    }

    if (isProviderReturn) {
      let cancelled = false;
      let attempts = 0;

      const waitForConfirmation = async () => {
        while (!cancelled && attempts < 12) {
          attempts += 1;
          const { data, error: receiptError } = await supabase.rpc('get_order_receipt', {
            p_order_number: orderNumber,
            p_tracking_token: trackingToken,
          });
          if (receiptError) {
            console.error('[PAYMENT_CONFIRMATION_POLL_ERROR]', receiptError.message);
          }
          const receipt = data?.receipt;
          if (data?.success && receipt && ['failed', 'cancelled', 'expired'].includes(receipt.status)) {
            setPaymentState('failed');
            return;
          }
          if (
            data?.success &&
            receipt &&
            (receipt.status === 'paid' || receipt.status === 'confirmed') &&
            receipt.amounts?.paid > 0
          ) {
            window.location.href = `/recu?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(trackingToken)}`;
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        if (!cancelled) {
          setPaymentState('pending_confirmation');
        }
      };

      waitForConfirmation();
      return () => {
        cancelled = true;
      };
    }

    // Prevent double-initiation (redirect loop guard)
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    const initiate = async () => {
      try {
        const response = await fetch('/api/payment/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_number: orderNumber,
            tracking_token: trackingToken,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'Une erreur est survenue.');
          setPaymentState('error');
          return;
        }

        if (result.already_paid) {
          window.location.href = `/recu?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(trackingToken)}`;
          return;
        }

        if (result.payment_url) {
          setPaymentState('redirecting');
          window.location.href = result.payment_url;
          return;
        }

        setError('Reponse inattendue du serveur.');
        setPaymentState('error');
      } catch {
        setError('Une erreur est survenue. Verifiez votre connexion.');
        setPaymentState('error');
      }
    };

    initiate();
  }, [isProviderReturn, orderNumber, supabase, trackingToken]);

  if (paymentState === 'loading' || paymentState === 'redirecting') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">
          {paymentState === 'redirecting'
            ? 'Redirection vers la page de paiement...'
            : 'Chargement...'}
        </p>
      </div>
    );
  }

  if (paymentState === 'not_found') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-4">Lien de paiement invalide</h1>
        <p className="text-gray-600 mb-8">
          Ce lien de paiement est incomplet ou incorrect.
        </p>
        <Link href="/" className="text-primary-600 hover:text-primary-500 font-medium">
          Retour a l&apos;accueil
        </Link>
      </div>
    );
  }

  if (paymentState === 'success') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-3">Paiement deja confirme</h1>
        <p className="text-gray-600 mb-8">
          Le paiement est confirmé. Votre reçu est disponible.
        </p>
        <Link
          href={`/recu?order=${orderNumber}&token=${trackingToken}`}
          className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors"
        >
          Voir mon reçu
        </Link>
        <Link
          href={`/suivi?order=${orderNumber}&token=${trackingToken}`}
          className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors"
        >
          Suivre ma commande
        </Link>
      </div>
    );
  }

  if (paymentState === 'pending_confirmation') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-3">
          Paiement reçu, confirmation en cours
        </h1>
        <p className="text-gray-600 mb-8">
          Votre paiement a été accepté. La confirmation finale et le reçu
          seront disponibles dès réception du webhook.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/recu?order=${orderNumber}&token=${trackingToken}`}
            className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors"
          >
            Ouvrir le reçu
          </Link>
          <Link
            href={`/suivi?order=${orderNumber}&token=${trackingToken}`}
            className="px-6 py-3 rounded-lg border border-primary-200 text-gray-700 font-medium hover:bg-[#FAFAF8] transition-colors"
          >
            Suivre la commande
          </Link>
        </div>
      </div>
    );
  }

  if (paymentState === 'failed') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-3">Paiement échoué</h1>
        <p className="text-gray-600 mb-8">
          Le paiement n&apos;a pas été confirmé. Vous pouvez réessayer sans créer une nouvelle commande.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
        <XCircle className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-3">Erreur de paiement</h1>
      <p className="text-gray-600 mb-8">{error}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors"
        >
          Reessayer
        </button>
        <Link
          href="/"
          className="px-6 py-3 rounded-lg border border-primary-200 text-gray-700 font-medium hover:bg-[#FAFAF8] transition-colors"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

export default function PaiementPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      }>
        <PaiementForm />
      </Suspense>
    </main>
  );
}
