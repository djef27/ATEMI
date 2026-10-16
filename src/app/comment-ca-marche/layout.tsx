import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comment Ça Marche — Atémi',
  description: 'Découvrez comment fonctionne Atémi. Les moyens de paiement et options de livraison dépendent des marchés actuellement ouverts ; le Bénin est notre premier marché.',
  alternates: { canonical: 'https://atemi.bj/comment-ca-marche' },
};

export default function CommentCaMarcheLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
