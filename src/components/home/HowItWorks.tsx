'use client';

import { ShoppingBag, CreditCard, Truck } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';

const steps = [
  {
    icon: ShoppingBag,
    title: 'Choisissez vos produits',
    description: 'Parcourez notre catalogue et trouvez ce qui vous plaît.',
  },
  {
    icon: CreditCard,
    title: 'Payez l\'acompte',
    description: 'Commandez en payant un pourcentage configuré par le vendeur.',
  },
  {
    icon: Truck,
    title: 'Recevez à domicile',
    description: 'Livraison à domicile. Payez le solde au moment de la réception.',
  },
];

export default function HowItWorks() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="relative py-16 sm:py-20 bg-primary-50 overflow-hidden texture-diagonal" ref={ref}>
      {/* Decorative accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-300 via-accent-400 to-primary-300" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <div className={`text-center mb-12 transition-[opacity,transform] duration-700 motion-reduce:transition-none ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <SectionHeader
            tagline="Simple & rapide"
            title="Comment ça marche"
            align="center"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className={`text-center p-8 rounded-2xl bg-white/60 backdrop-blur-sm border border-primary-100/50 transition-[box-shadow,transform] duration-700 motion-reduce:transition-none hover:shadow-lg hover:shadow-primary-200/30 hover:-translate-y-1 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${idx * 150}ms` }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-800 to-primary-900 text-primary-300 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-900/20">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-serif font-semibold text-[#1A1919] mb-2 text-lg">
                  {idx + 1}. {step.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
