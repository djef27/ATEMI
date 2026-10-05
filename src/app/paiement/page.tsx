'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/hooks/use-cart';

type PaymentState = 'loading' | 'redirecting' | 'ready_to_pay' | 'verifying' | 'success' | 'pending_confirmation' | 'failed' | 'error' | 'not_found';

interface KKiaPayWidgetOptions {
  amount: number;
  key: string;
  sandbox: boolean;
  phone?: string;
  name?: string;
  email?: string;
  paymentmethod: 'momo';
  countries: string[];
  partnerId: string;
  position: 'center';
}

interface KKiaPaySuccess {
  transactionId?: string;
  transaction_id?: string;
  id?: string;
}

interface KKiaPayInit {
  amount: number;
  public_key: string;
  sandbox: boolean;
  country: string;
  customer: { name: string; phone: string; email: string | null };
}

function normalizeKKiaPayPhone(phone: string, country: string): string {
  const callingCodes: Record<string, string> = { BJ: '229', CI: '225', TG: '228' };
  let localNumber = phone.replace(/\D/g, '');
  const callingCode = callingCodes[country];
  if (callingCode && localNumber.startsWith(callingCode)) {
    localNumber = localNumber.slice(callingCode.length);
  }
  if (country === 'BJ' && localNumber.startsWith('01') && localNumber.length === 10) {
    localNumber = localNumber.slice(2);
  } else if (localNumber.startsWith('0') && localNumber.length === 9) {
    localNumber = localNumber.slice(1);
  }
  return localNumber;
}

async function verifyKKiaPayTransaction(
  orderNumber: string,
  trackingToken: string,
  transactionId: string
): Promise<boolean> {
  const response = await fetch('/api/payment/kkiapay/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_number: orderNumber,
      tracking_token: trackingToken,
      transaction_id: transactionId,
    }),
  });
  const result = await response.json();
  if (response.status === 202 && result.pending) return false;
  if (!response.ok || !result.success) {
    if (response.status === 402) {
      sessionStorage.removeItem(`kkiapay:${orderNumber}`);
    }
    throw new Error(result.error || 'La vérification du paiement a échoué.');
  }
  return true;
}

declare global {
  interface Window {
    openKkiapayWidget?: (options: KKiaPayWidgetOptions) => void;
    addSuccessListener?: (listener: (response: KKiaPaySuccess) => void) => void;
  }
}

function PaiementForm() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const trackingToken = searchParams.get('token');
  const country = searchParams.get('country') || 'BJ';
  const paymentMethod = searchParams.get('payment_method') || 'mobile_money';
  const isProviderReturn = searchParams.get('return') === '1';
  const [paymentState, setPaymentState] = useState<PaymentState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [kkiapayInit, setKkiapayInit] = useState<KKiaPayInit | null>(null);
  const [pendingKkiapayTransactionId, setPendingKkiapayTransactionId] = useState<string | null>(null);
  const [mockAmount, setMockAmount] = useState<number | null>(null);
  const [kkiapayScriptReady, setKkiapayScriptReady] = useState(false);
  const initiatedRef = useRef(false);
  const successListenerRef = useRef(false);
  const verificationStartedRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);
  const { clearCart } = useCart();

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
            country,
            payment_method: paymentMethod,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'Une erreur est survenue.');
          setPaymentState('error');
          return;
        }

        if (result.already_paid) {
          clearCart();
          window.location.href = `/recu?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(trackingToken)}`;
          return;
        }

        if (result.provider === 'kkiapay') {
          clearCart();
          setKkiapayInit(result);
          const transactionId = result.transaction_id ||
            sessionStorage.getItem(`kkiapay:${orderNumber}`);
          if (transactionId) {
            setPendingKkiapayTransactionId(transactionId);
            setPaymentState('verifying');
          } else {
            setPaymentState('ready_to_pay');
          }
          return;
        }

        if (result.provider === 'mock' && typeof result.amount === 'number') {
          setMockAmount(result.amount);
          setPaymentState('ready_to_pay');
          return;
        }

        if (result.payment_url) {
          clearCart();
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
  }, [clearCart, country, isProviderReturn, orderNumber, paymentMethod, supabase, trackingToken]);

  useEffect(() => {
    if (!pendingKkiapayTransactionId || !orderNumber || !trackingToken) return;
    verificationStartedRef.current = true;
    verifyKKiaPayTransaction(orderNumber, trackingToken, pendingKkiapayTransactionId)
      .then((confirmed) => {
        if (!confirmed) {
          setPaymentState('pending_confirmation');
          return;
        }
        sessionStorage.removeItem(`kkiapay:${orderNumber}`);
        window.location.href = `/recu?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(trackingToken)}`;
      })
      .catch((verificationError: unknown) => {
        setError(verificationError instanceof Error ? verificationError.message : 'La vérification du paiement a échoué.');
        setPaymentState('error');
      });
  }, [orderNumber, pendingKkiapayTransactionId, trackingToken]);

  useEffect(() => {
    if (!kkiapayInit || !kkiapayScriptReady || successListenerRef.current) return;
    if (!window.addSuccessListener) {
      setError('Le module de paiement KKiaPay n’a pas pu être chargé.');
      setPaymentState('error');
      return;
    }

    window.addSuccessListener((result) => {
      if (verificationStartedRef.current) return;
      verificationStartedRef.current = true;
      const transactionId = result.transactionId || result.transaction_id || result.id;
      if (!transactionId || !orderNumber || !trackingToken) {
        setError('KKiaPay n’a pas retourné de référence de transaction.');
        setPaymentState('error');
        return;
      }

      sessionStorage.setItem(`kkiapay:${orderNumber}`, transactionId);
      setPaymentState('verifying');
      verifyKKiaPayTransaction(orderNumber, trackingToken, transactionId)
        .then((confirmed) => {
          if (!confirmed) {
            setPaymentState('pending_confirmation');
            return;
          }
          sessionStorage.removeItem(`kkiapay:${orderNumber}`);
          window.location.href = `/recu?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(trackingToken)}`;
        })
        .catch((verificationError: unknown) => {
          setError(verificationError instanceof Error ? verificationError.message : 'La vérification du paiement a échoué.');
          setPaymentState('error');
        });
    });
    successListenerRef.current = true;
  }, [kkiapayInit, kkiapayScriptReady, orderNumber, trackingToken]);

  if (paymentState === 'loading' || paymentState === 'redirecting' || paymentState === 'verifying') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">
          {paymentState === 'redirecting' ? 'Redirection vers la page de paiement...' :
            paymentState === 'verifying' ? 'Vérification sécurisée du paiement...' : 'Chargement...'}
        </p>
      </div>
    );
  }

  if (paymentState === 'ready_to_pay' && mockAmount !== null) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-3">Simulation de paiement</h1>
        <p className="text-gray-600 mb-2">Commande {orderNumber}</p>
        <p className="text-gray-600 mb-4">Montant simulé : {new Intl.NumberFormat('fr-FR').format(mockAmount)} XOF</p>
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-6">
          Mode de développement uniquement : aucun paiement réel ne sera effectué.
        </p>
        <button
          type="button"
          onClick={() => {
            setPaymentState('verifying');
            fetch('/api/payment/mock/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_number: orderNumber,
                tracking_token: trackingToken,
                country,
                payment_method: paymentMethod,
              }),
            })
              .then(async (response) => {
                const result = await response.json();
                if (!response.ok || !result.success) {
                  throw new Error(result.error || 'La simulation de paiement a échoué.');
                }
                clearCart();
                window.location.href = `/recu?order=${encodeURIComponent(orderNumber || '')}&token=${encodeURIComponent(trackingToken || '')}`;
              })
              .catch((confirmationError: unknown) => {
                setError(confirmationError instanceof Error ? confirmationError.message : 'La simulation de paiement a échoué.');
                setPaymentState('error');
              });
          }}
          className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800"
        >
          Simuler le paiement
        </button>
      </div>
    );
  }

  if (paymentState === 'ready_to_pay' && kkiapayInit) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Script
          src="https://cdn.kkiapay.me/k.js"
          strategy="afterInteractive"
          onLoad={() => setKkiapayScriptReady(true)}
          onError={() => {
            setError('Impossible de charger le module de paiement KKiaPay.');
            setPaymentState('error');
          }}
        />
        <h1 className="text-2xl font-bold text-[#1A1919] font-serif mb-3">Paiement sécurisé</h1>
        <p className="text-gray-600 mb-2">Commande {orderNumber}</p>
        <p className="text-gray-600 mb-8">Montant à payer : {new Intl.NumberFormat('fr-FR').format(kkiapayInit.amount)} XOF</p>
        <button
          type="button"
          disabled={!kkiapayScriptReady}
          onClick={() => {
            if (!window.openKkiapayWidget) {
              setError('Le module KKiaPay n’est pas disponible. Rechargez la page pour réessayer.');
              setPaymentState('error');
              return;
            }
            window.openKkiapayWidget({
              amount: kkiapayInit.amount,
              key: kkiapayInit.public_key,
              sandbox: kkiapayInit.sandbox,
              phone: normalizeKKiaPayPhone(kkiapayInit.customer.phone, kkiapayInit.country),
              name: kkiapayInit.customer.name,
              email: kkiapayInit.customer.email || undefined,
              paymentmethod: 'momo',
              countries: [kkiapayInit.country],
              partnerId: orderNumber || '',
              position: 'center',
            });
          }}
          className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {kkiapayScriptReady ? 'Payer avec KKiaPay' : 'Chargement du paiement...'}
        </button>
        <p className="text-xs text-gray-500 mt-4">Votre commande est confirmée uniquement après vérification du paiement par notre serveur.</p>
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
          seront disponibles après confirmation par le fournisseur.
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
