'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Package, Truck, CreditCard, Copy } from 'lucide-react';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const trackingToken = searchParams.get('token');
  const email = searchParams.get('email');

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1919] font-serif mb-3">
            Commande confirmée !
          </h1>

          <p className="text-gray-600 mb-6">
            Merci pour votre commande. Vous allez recevoir une confirmation avec les détails de votre acompte.
          </p>
        </div>

        {orderNumber && (
          <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-medium text-gray-500 mb-1">Numéro de commande</h2>
            <p className="text-2xl font-bold text-primary-700 font-mono">{orderNumber}</p>

            {trackingToken && (
              <div className="mt-4 pt-4 border-t border-primary-100">
                <p className="text-xs text-gray-500 mb-1">Token de suivi (conservez-le)</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-gray-50 px-3 py-2 rounded-lg flex-1 overflow-x-auto text-gray-700 font-mono">
                    {trackingToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(trackingToken)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    title="Copier le token"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Ce token vous permet de suivre votre commande sans compte.
                </p>
              </div>
            )}

            {email && (
              <div className="mt-4 pt-4 border-t border-primary-100">
                <p className="text-sm text-gray-600">
                  Un e-mail de confirmation sera envoyé à : <span className="font-medium">{email}</span>
                </p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#1A1919] font-serif mb-4">Prochaines étapes</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">1. Payez l&apos;acompte</h3>
                <p className="text-sm text-gray-600">
                  Un agent vous contacte pour confirmer.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">2. Préparation</h3>
                <p className="text-sm text-gray-600">
                  Après confirmation du paiement.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">3. Livraison</h3>
                <p className="text-sm text-gray-600">
                  À domicile ou selon convenu.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {orderNumber && trackingToken && (
            <Link
              href={`/suivi?order=${orderNumber}&token=${trackingToken}`}
              className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium text-center hover:bg-primary-800 transition-colors"
            >
              Suivre ma commande
            </Link>
          )}
          {orderNumber && (
            <Link
              href={trackingToken ? `/paiement?order=${orderNumber}&token=${trackingToken}` : `/paiement?order=${orderNumber}`}
              className="px-6 py-3 rounded-lg border border-primary-200 text-gray-700 font-medium text-center hover:bg-[#FAFAF8] transition-colors"
            >
              Payer l&apos;acompte
            </Link>
          )}
          <Link
            href="/"
            className="px-6 py-3 rounded-lg border border-primary-200 text-gray-700 font-medium text-center hover:bg-[#FAFAF8] transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>

        {!email && (
          <div className="mt-12 text-center p-6 bg-primary-50 rounded-2xl">
            <h3 className="font-serif text-lg font-semibold text-[#1A1919] mb-2">
              Créez votre compte
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Retrouvez facilement vos commandes et commandez plus rapidement la prochaine fois.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
              >
                Créer mon compte
              </Link>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-lg border border-primary-200 text-gray-600 text-sm font-medium hover:bg-white transition-colors"
              >
                Continuer sans compte
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
