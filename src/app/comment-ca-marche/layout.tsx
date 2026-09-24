import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comment Ça Marche — Atémi',
  description: 'Découvrez comment fonctionne Atémi : sélection de produits, achat sécurisé, livraison rapide au Bénin.',
  alternates: { canonical: 'https://atemi.bj/comment-ca-marche' },
};

export default function CommentCaMarcheLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
