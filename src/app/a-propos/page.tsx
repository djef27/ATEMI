import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'À propos',
  description: 'Marketplace africaine de mode, beauté et accessoires — vendeurs et créateurs, au Bénin d&apos;abord.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1919] mb-4">
            À propos d&apos;Atémi
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            La marketplace des talents d&apos;Afrique — marché par marché.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-bold text-[#1A1919] mb-4">Notre mission</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 leading-relaxed">
              Atémi aide les créateurs et vendeurs d&apos;Afrique à se faire découvrir, avec une
              plateforme simple et fiable.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              Notre nom vient du fon : &ldquo;Atémi&rdquo; signifie &ldquo;beauté&rdquo;.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-bold text-[#1A1919] mb-8">Nos valeurs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: 'Qualité',
                description: 'Les informations produit sont fournies pour bien choisir.',
              },
              {
                title: 'Confiance',
                description: 'Paiement et livraison précisés avant validation.',
              },
              {
                title: 'Accessibilité',
                description: 'Moyens de paiement et livraison selon les marchés ouverts.',
              },
              {
                title: 'Communauté',
                description: 'Soutenir les entrepreneurs locaux, marché par marché.',
              },
            ].map((value) => (
              <div key={value.title} className="bg-white rounded-2xl border border-primary-100 p-6 shadow-sm">
                <h3 className="font-serif font-semibold text-[#1A1919] mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-bold text-[#1A1919] mb-8">Comment ça marche</h2>
          <div className="space-y-6">
            {[
              { step: '1', title: 'Choisissez vos produits', description: 'Parcourez le catalogue.' },
              { step: '2', title: 'Payez un acompte', description: 'Un pourcentage du total seulement.' },
              { step: '3', title: 'Choisissez une option disponible', description: 'Livraison ou retrait selon le pays et la zone.' },
              { step: '4', title: 'Solde à la livraison', description: 'Le reste, à réception du colis.' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-900 text-white flex items-center justify-center font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1919] mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-[#1A1919] rounded-2xl p-8 sm:p-12">
          <h2 className="font-serif text-2xl font-bold text-white mb-4">Prêt à découvrir Atémi ?</h2>
          <p className="text-gray-300 mb-6">Parcourez le catalogue.</p>
          <Link
            href="/products"
            className="inline-block px-8 py-3 rounded-xl bg-white text-[#1A1919] font-semibold hover:bg-gray-100 transition-colors"
          >
            Voir le catalogue
          </Link>
        </section>
      </div>
    </main>
  );
}
