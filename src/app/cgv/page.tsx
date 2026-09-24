import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente',
  description: 'Conditions générales de vente de la boutique Atémi.',
};

export default function CGVPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1A1919] font-serif mb-8">Conditions Générales de Vente</h1>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 1 — Objet</h2>
            <p>
              Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles
              entre la société Atémi, exploitée par la boutique en ligne atemi.bj, et tout client
              effectuant un achat sur le site atemi.bj.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 2 — Produits</h2>
            <p>
              Les produits proposés à la vente sont ceux figurant sur le site atemi.bj.
              Chaque produit est présenté avec une description permettant d&apos;en connaître les
              caractéristiques essentielles. Les photographies des produits sont aussi fidèles que possible
              mais ne sauraient garantir une similitude parfaite avec le produit réel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 3 — Prix</h2>
            <p>
              Les prix sont indiqués en Francs CFA (FCFA) et sont susceptibles d&apos;être modifiés à tout moment.
              Le prix applicable est celui en vigueur au moment de la validation de la commande par le client.
              Les frais de livraison ne sont pas inclus dans le prix des produits et sont indiqués avant la
              validation de la commande.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 4 — Paiement en deux fois</h2>
            <p>
              Atémi propose un système de paiement en deux fois :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Acompte</strong> : Un pourcentage du prix total (défini par le vendeur) est payé
                lors de la commande. Cet acompte valide la commande.
              </li>
              <li>
                <strong>Solde</strong> : Le montant restant est payé au moment de la livraison, directement
                au livreur ou au vendeur.
              </li>
            </ul>
            <p>
              Les modes de paiement acceptés sont : Mobile Money (Moov, MTN), virement bancaire, et espèces.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 5 — Commande</h2>
            <p>
              La commande est validée lorsque le client a complété toutes les étapes du processus de commande :
              choix des produits, saisie des informations personnelles, confirmation du mode de livraison,
              et paiement de l&apos;acompte. Un email de confirmation est envoyé au client.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 6 — Livraison</h2>
            <p>
              La livraison est effectuée à l&apos;adresse indiquée par le client lors de la commande.
              Le délai de livraison est indicatif et peut varier selon la zone de livraison et la disponibilité
              du produit. Atémi s&apos;efforce de livrer dans les meilleurs délais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 7 — Droit de rétractation</h2>
            <p>
              Conformément à la législation en vigueur au Bénin, le client dispose d&apos;un délai de 14 jours
              pour exercer son droit de rétractation, sans avoir à justifier de motif. Ce délai court à
              compter de la réception du produit. Le produit doit être retourné dans son état d&apos;origine.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 8 — Garanties</h2>
            <p>
              Tous les produits vendus sur atemi.bj bénéficient de la garantie légale de conformité.
              En cas de défaut, le client peut demander l&apos;échange ou le remboursement du produit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 9 — Responsabilité</h2>
            <p>
              Atémi ne saurait être tenu responsable des dommages résultant d&apos;une utilisation
              non conforme des produits. La responsabilité d&apos;Atémi est limitée au montant de la commande.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 10 — Protection des données</h2>
            <p>
              Les données personnelles collectées sont traitées conformément à notre Politique de
              Confidentialité. Pour plus d&apos;informations, veuillez consulter notre page dédiée.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-semibold text-[#1A1919]">Article 11 — Droit applicable</h2>
            <p>
              Les présentes CGV sont régies par le droit béninois. En cas de litige, les tribunaux
              compétents de Cotonou seront seuls compétents.
            </p>
          </section>

          <p className="text-sm text-gray-500 pt-4 border-t border-gray-200">
            Dernière mise à jour : 3 septembre 2026
          </p>
        </div>
      </div>
    </main>
  );
}
