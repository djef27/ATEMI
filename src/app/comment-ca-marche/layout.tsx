import type { Metadata } from 'next';
import { getAppUrl } from '@/lib/app-url';

export const metadata: Metadata = {
  title: 'Comment Ça Marche',
  description: 'Découvrez comment fonctionne Atémi. Les moyens de paiement et options de livraison dépendent des marchés actuellement ouverts ; le Bénin est notre premier marché.',
  alternates: { canonical: `${getAppUrl()}/comment-ca-marche` },
};

export default function CommentCaMarcheLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
