import { LandingPageClient } from '@/components/landing/LandingPageClient';
import { AuthRedirect } from '@/components/auth/AuthRedirect';

// Force dynamic rendering - landing page uses client session hooks
export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <>
      {/* Client component handles auth redirect */}
      <AuthRedirect />
      <LandingPageClient />
    </>
  );
}

