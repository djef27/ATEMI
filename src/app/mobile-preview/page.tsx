import { notFound } from 'next/navigation';
import MobilePreviewClient from '@/components/mobile-preview-client';

/**
 * /mobile-preview — Development-only mobile simulator.
 *
 * This page is ONLY accessible when NODE_ENV=development.
 * In production, it returns 404.
 *
 * It loads the real ATEMI site in an iframe with configurable
 * mobile device dimensions for responsive testing.
 */
export default function MobilePreviewPage() {
  // Block in production
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <MobilePreviewClient />;
}

export const metadata = {
  title: 'Mobile Preview — Dev Only',
  robots: { index: false, follow: false },
};
