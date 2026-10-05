import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { ToastProvider } from '@/components/toast-provider';
import Header from '@/components/header';
import Footer from '@/components/footer';
import ScrollToTop from '@/components/scroll-to-top';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Atémi | Mode, Chaussures & Perruques au Bénin',
    template: '%s | Atémi',
  },
  description: 'Découvrez une sélection de produits de qualité — mode, chaussures, perruques et accessoires. Payez en deux fois : acompte à la commande, solde à la livraison.',
  keywords: ['mode', 'chaussures', 'perruques', 'bénin', 'boutique', 'ecommerce', 'acompte', 'livraison'],
  openGraph: {
    title: 'Atémi | Mode, Chaussures & Perruques au Bénin',
    description: 'Découvrez une sélection de produits de qualité. Payez en deux fois.',
    type: 'website',
    locale: 'fr_BJ',
    siteName: 'Atémi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atémi | Mode, Chaussures & Perruques au Bénin',
    description: 'Découvrez une sélection de produits de qualité. Payez en deux fois.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="font-sans">
        <AuthProvider>
          <ToastProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-900 focus:text-white focus:rounded-lg"
            >
              Aller au contenu principal
            </a>
            <Header />
            <main id="main-content">{children}</main>
            <Footer />
            <ScrollToTop />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
