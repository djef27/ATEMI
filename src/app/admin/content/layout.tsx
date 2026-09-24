import { isContentEngineEnabled } from '@/lib/ai-engine/config/feature-flag';
import ContentLayoutClient from './content-layout-client';

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ContentLayoutClient enabled={isContentEngineEnabled()}>
      {children}
    </ContentLayoutClient>
  );
}