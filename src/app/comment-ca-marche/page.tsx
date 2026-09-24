'use client';

import Link from 'next/link';
import { ShoppingBag, CreditCard, Truck, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: ShoppingBag,
    title: 'Choisissez vos produits',
    description: 'Parcourez notre catalogue et ajoutez les articles qui vous plaisent à votre panier. Chaque produit affiche son prix et le taux d\u2019acompte applicable.',
  },
  {
    icon: CreditCard,
    title: 'Payez l\u2019acompte',
    description: 'Passez commande en ne payant qu\u2019un pourcentage du prix total. Le montant exact est calculé automatiquement selon le taux défini par le vendeur.',
  },
  {
    icon: Truck,
    title: 'Livraison à domicile',
    description: 'Votre commande est préparée et livrée à l\u2019adresse indiquée. Vous pouvez aussi choisir le retrait en boutique.',
  },
  {
    icon: CheckCircle,
    title: 'Payez le solde à la livraison',
    description: 'Au moment de la livraison, vous payez le montant restant directement au livreur ou au vendeur.',
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
            Achetez en toute confiance grâce à notre système de paiement en deux fois.
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
