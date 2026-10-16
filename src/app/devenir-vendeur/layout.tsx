import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Devenir Vendeur — Atémi',
  description: 'Rejoignez Atémi, une marketplace qui met en lumière les vendeurs africains. Les inscriptions vendeurs débutent au Bénin.',
  alternates: { canonical: 'https://atemi.bj/devenir-vendeur' },
};

export default function DevenirVendeurLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
