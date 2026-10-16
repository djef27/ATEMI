import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'À propos',
  description: 'Découvrez Atémi, une marketplace africaine qui met en lumière les vendeurs, les créateurs et les communautés locales. Le Bénin est notre premier marché.',
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
            Une marketplace pensée pour les talents et les communautés d’Afrique, avec un lancement progressif marché par marché.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-bold text-[#1A1919] mb-4">Notre mission</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 leading-relaxed">
              Atémi est née d&apos;une conviction simple : les communautés africaines regorgent de talents
              créatifs et de produits de qualité. Nous construisons une plateforme moderne et accessible
              pour aider les vendeurs à faire découvrir leur savoir-faire et permettre aux clients de
              trouver des produits qui leur ressemblent.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              Notre nom vient du fon, langue parlée notamment au Bénin, où &ldquo;Atémi&rdquo; signifie
              &ldquo;beauté&rdquo;. Cette origine fait partie de notre histoire ; notre ambition est de
              célébrer la diversité des cultures et des créations africaines.
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
                description: 'Nous mettons à disposition les informations produit fournies afin que chacun puisse choisir en connaissance de cause.',
              },
              {
                title: 'Confiance',
                description: 'Les modalités de paiement et de livraison sont précisées avant la validation de chaque commande.',
              },
              {
                title: 'Accessibilité',
                description: 'Les moyens de paiement et les options de livraison varient selon les marchés et les zones effectivement disponibles.',
              },
              {
                title: 'Communauté',
                description: 'Nous voulons soutenir les entrepreneurs locaux et les économies numériques africaines, marché par marché.',
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
              { step: '1', title: 'Choisissez vos produits', description: 'Parcourez notre catalogue et trouvez ce qui vous plaît.' },
              { step: '2', title: 'Payez un acompte', description: 'Réservez votre commande en payant seulement un pourcentage du total.' },
              { step: '3', title: 'Choisissez une option disponible', description: 'Les options de livraison ou de retrait dépendent du pays et de la zone proposés au checkout. Notre premier marché est le Bénin.' },
              { step: '4', title: 'Solde à la livraison', description: 'Payez le reste du montant uniquement lorsque vous avez reçu et vérifié votre colis.' },
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
          <p className="text-gray-300 mb-6">Parcourez notre sélection de produits de qualité.</p>
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
