import { LandingPageClient } from '@/components/landing/LandingPageClient';
import { AuthRedirect } from '@/components/auth/AuthRedirect';

export default function LandingPage() {
  return (
    <>
      {/* Client component handles auth redirect */}
      <AuthRedirect />
      <LandingPageClient />
    </>
  );
}

