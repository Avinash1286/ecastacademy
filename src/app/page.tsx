import { LandingPageClient } from '@/components/landing/LandingPageClient';
import { AuthRedirect } from '@/components/auth/AuthRedirect';

// Static generation for landing page - auth check is client-side and non-blocking
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

export default function LandingPage() {
  return (
    <>
      {/* Client component handles auth redirect - non-blocking */}
      <AuthRedirect />
      <LandingPageClient />
    </>
  );
}

