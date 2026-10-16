import { Truck, CreditCard, Shield, MessageCircle } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { ScrollReveal } from './ScrollReveal';

const engagements = [
  {
    icon: Truck,
    title: 'Livraison fiable',
    description: 'Les options et zones de livraison disponibles sont précisées au moment de la commande.',
  },
  {
    icon: CreditCard,
    title: 'Paiement transparent',
    description: 'Les moyens de paiement disponibles pour votre marché sont indiqués au checkout.',
  },
  {
    icon: Shield,
    title: 'Informations protégées',
    description: 'Consultez notre politique de confidentialité pour savoir comment vos données sont traitées.',
  },
  {
    icon: MessageCircle,
    title: 'Support WhatsApp',
    description: 'Une question sur un produit ou une commande ? Écrivez-nous sur WhatsApp.',
  },
];

export default function TrustEngagements() {
  return (
    <section className="relative py-16 sm:py-20 bg-[#FAFAF8] overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-100/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <ScrollReveal>
          <SectionHeader
            tagline="Pourquoi nous"
            title="Nos engagements"
            align="center"
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {engagements.map((item, idx) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={idx} delay={idx * 100}>
                <div className="text-center group p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-primary-100/50 hover:bg-white hover:shadow-lg hover:shadow-primary-200/20 transition-[background-color,box-shadow,transform] duration-300 motion-reduce:transition-none hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 text-primary-800 flex items-center justify-center mx-auto mb-5 group-hover:from-primary-200 group-hover:to-primary-300 transition-[background-image,box-shadow] duration-300 motion-reduce:transition-none shadow-sm">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif font-semibold text-[#1A1919] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
