import type { Metadata } from 'next';
import { getAppUrl } from '@/lib/app-url';

export const metadata: Metadata = {
  title: 'Devenir Vendeur',
  description: 'Rejoignez Atémi, une marketplace qui met en lumière les vendeurs africains. Les inscriptions vendeurs débutent au Bénin.',
  alternates: { canonical: `${getAppUrl()}/devenir-vendeur` },
};

export default function DevenirVendeurLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
