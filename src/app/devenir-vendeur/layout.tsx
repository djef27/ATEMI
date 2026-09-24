import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Devenir Vendeur — Atémi',
  description: 'Rejoignez la plateforme Atémi en tant que vendeur et offrez vos produits à toute la clientèle béninoise.',
  alternates: { canonical: 'https://atemi.bj/devenir-vendeur' },
};

export default function DevenirVendeurLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
