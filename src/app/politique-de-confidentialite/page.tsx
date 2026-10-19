import type { Metadata } from 'next';
import { getContactConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité',
  description: 'Politique de confidentialité de la boutique Atémi.',
};

export default function PolitiqueConfidentialitePage() {
  const contact = getContactConfig();

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1A1919] font-serif mb-8">Politique de Confidentialité</h1>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">1. Collecte des informations</h2>
            <p>
              Nous collectons les informations que vous nous fournissez directement lors de votre
              inscription, de votre passage de commande ou de votre contact avec notre service client.
              Ces informations peuvent inclure :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nom et prénom</li>
              <li>Adresse email</li>
              <li>Numéro de téléphone</li>
              <li>Adresse de livraison</li>
              <li>Historique de commandes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">2. Utilisation des informations</h2>
            <p>Nous utilisons vos informations pour :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Traiter et livrer vos commandes</li>
              <li>Vous envoyer des confirmations de commande et des mises à jour</li>
              <li>Améliorer nos services et votre expérience utilisateur</li>
              <li>Vous contacter en cas de besoin concernant votre commande</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">3. Partage des informations</h2>
            <p>
              Nous ne vendons pas vos données personnelles à des tiers. Vos informations peuvent être
              partagées uniquement avec :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Les vendeurs de la plateforme (uniquement les informations nécessaires à la préparation et à la livraison de votre commande)</li>
              <li>Les services de livraison (nom, adresse, téléphone)</li>
              <li>Les prestataires de paiement (pour le traitement sécurisé des transactions)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">4. Sécurité des données</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
              vos données personnelles contre tout accès non autorisé, altération, divulgation ou destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">5. Cookies</h2>
            <p>
              Notre site utilise des cookies pour améliorer votre expérience de navigation. Les cookies
              sont de petits fichiers stockés sur votre appareil qui nous permettent de reconnaître votre
              navigateur et de mémoriser certaines informations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">6. Vos droits</h2>
            <p>Conformément à la législation applicable, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
              <li><strong>Droit de suppression</strong> : demander la suppression de vos données</li>
              <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement de vos données</li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à l&apos;adresse : {contact.email || 'non configuré'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">7. Conservation des données</h2>
            <p>
              Vos données personnelles sont conservées pendant la durée nécessaire aux finalités pour
              lesquelles elles ont été collectées, et conformément aux obligations légales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">8. Contact</h2>
            <p>
              Pour toute question relative à cette politique de confidentialité, contactez-nous :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Email : {contact.email || 'non configuré'}</li>
              <li>Téléphone : {contact.phoneDisplay}</li>
              <li>Adresse : {contact.city}, {contact.country}</li>
            </ul>
          </section>

          <p className="text-sm text-gray-500 pt-4 border-t border-gray-200">
            Dernière mise à jour : 3 septembre 2026
          </p>
        </div>
      </div>
    </main>
  );
}
