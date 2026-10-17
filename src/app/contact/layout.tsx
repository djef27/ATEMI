import type { Metadata } from 'next';
import { getAppUrl } from '@/lib/app-url';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contactez l\'équipe Atémi pour toute question, suggestion ou besoin d\'assistance. Nous sommes à votre écoute.',
  alternates: { canonical: `${getAppUrl()}/contact` },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
