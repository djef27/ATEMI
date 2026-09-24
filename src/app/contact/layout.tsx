import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact — Atémi',
  description: 'Contactez l\'équipe Atémi pour toute question, suggestion ou besoin d\'assistance. Nous sommes à votre écoute.',
  alternates: { canonical: 'https://atemi.bj/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
