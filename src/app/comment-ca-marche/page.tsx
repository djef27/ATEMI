'use client';

import Link from 'next/link';
import { ShoppingBag, CreditCard, Truck, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: ShoppingBag,
    title: 'Choisissez vos produits',
    description: 'Parcourez le catalogue, consultez les informations de chaque article et ajoutez vos choix au panier.',
  },
  {
    icon: CreditCard,
    title: 'Vérifiez les options de paiement',
    description: 'Au checkout, consultez les moyens de paiement et les modalités réellement proposés pour votre commande avant de la valider.',
  },
  {
    icon: Truck,
    title: 'Choisissez une option de réception',
    description: 'Les options de livraison ou de retrait dépendent de votre zone et sont affichées au checkout lorsqu’elles sont disponibles.',
  },
  {
    icon: CheckCircle,
    title: 'Suivez votre commande',
    description: 'Après confirmation, retrouvez les informations et le suivi de votre commande dans votre espace client.',
  },
];

export default function CommentCaMarchePage() {
  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-12">
          <p className="tagline mb-2">Simple &amp; transparent</p>
          <h1 className="section-heading mb-4">
            Comment ça marche&nbsp;?
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Atémi met en relation vendeurs et clients en Afrique. Notre premier marché est le Bénin ; les moyens de paiement et de livraison dépendent des options ouvertes pour chaque commande.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-primary-100 p-6 flex gap-4 shadow-sm"
              >
                <div className="shrink-0 w-12 h-12 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-[#1A1919] mb-1">
                    {idx + 1}. {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#1A1919] rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="font-serif text-xl font-semibold text-white mb-2">Prêt à commander&nbsp;?</h2>
          <p className="text-gray-400 mb-6">
            Parcourez notre catalogue et trouvez ce que vous recherchez.
          </p>
          <Link
            href="/products"
            className="inline-block px-6 py-3 rounded-lg bg-white text-[#1A1919] font-medium hover:bg-gray-100 transition-colors"
          >
            Voir le catalogue
          </Link>
        </div>
      </div>
    </main>
  );
}
