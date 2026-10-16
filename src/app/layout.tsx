import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { ToastProvider } from '@/components/toast-provider';
import Header from '@/components/header';
import Footer from '@/components/footer';
import ScrollToTop from '@/components/scroll-to-top';
import { getAppUrl } from '@/lib/app-url';

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: 'Atémi | Marketplace africaine de mode, beauté et accessoires',
    template: '%s | Atémi',
  },
  description: 'Atémi met en lumière les vendeurs et les créations d’Afrique. Notre premier marché est le Bénin ; les paiements et livraisons disponibles sont indiqués selon votre pays et votre zone.',
  keywords: ['marketplace africaine', 'mode africaine', 'créateurs africains', 'chaussures', 'beauté', 'perruques', 'accessoires', 'commerce en ligne', 'Bénin'],
  openGraph: {
    title: 'Atémi | La marketplace des talents africains',
    description: 'Découvrez les créations et les vendeurs d’Afrique. Disponibilité selon les marchés actuellement ouverts.',
    type: 'website',
    siteName: 'Atémi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atémi | La marketplace des talents africains',
    description: 'Découvrez les créations et les vendeurs d’Afrique. Disponibilité selon les marchés actuellement ouverts.',
  },
};

export const viewport: Viewport = {
  themeColor: '#544030',
  colorScheme: 'light',
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
            <div id="main-content" tabIndex={-1}>
              {children}
            </div>
            <Footer />
            <ScrollToTop />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
