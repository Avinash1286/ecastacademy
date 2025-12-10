import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Animated background - matching landing page */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '8s' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '8s', animationDelay: '2s' }}
        />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23888' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Navigation back to home */}
      <div className="absolute top-4 left-4 z-10">
        <Link 
          href="/" 
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7"/>
            <path d="M19 12H5"/>
          </svg>
          Back to home
        </Link>
      </div>

      {/* Sign Up component */}
      <div className="relative z-10">
        <SignUp 
          appearance={{
            baseTheme: dark,
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-card/80 backdrop-blur-xl border border-border shadow-2xl',
              headerTitle: 'text-2xl font-bold text-foreground',
              headerSubtitle: 'text-muted-foreground',
              socialButtonsBlockButton: 'bg-secondary/50 hover:bg-secondary/80 border border-border/50 !text-foreground',
              socialButtonsBlockButtonText: '!text-foreground font-medium',
              socialButtonsProviderIcon__google: '',
              socialButtonsProviderIcon__github: 'invert',
              dividerLine: 'bg-border',
              dividerText: 'text-muted-foreground',
              formFieldLabel: 'text-foreground',
              formFieldInput: 'bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-primary focus:border-primary',
              formFieldAction: 'text-primary hover:text-primary/80',
              formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground text-sm normal-case shadow-lg',
              footerActionText: 'text-muted-foreground',
              footerActionLink: 'text-primary hover:text-primary/80',
              identityPreviewText: 'text-foreground',
              identityPreviewEditButton: 'text-primary hover:text-primary/80',
              formFieldInputShowPasswordButton: 'text-muted-foreground hover:text-foreground',
              otpCodeFieldInput: 'bg-background border border-border text-foreground placeholder:text-muted-foreground',
              formResendCodeLink: 'text-primary hover:text-primary/80',
              alertText: 'text-foreground',
              alternativeMethodsBlockButtonText: 'text-foreground',
              alternativeMethodsBlockButton: 'text-foreground',
            },
            variables: {
              colorPrimary: '#22c55e',
              colorText: '#fafafa',
              colorTextSecondary: '#a1a1aa',
              colorTextOnPrimaryBackground: '#0a0a0a',
              colorBackground: '#1c1c1c',
              colorInputBackground: '#262626',
              colorInputText: '#fafafa',
              colorDanger: '#f87171',
              borderRadius: '0.625rem',
            },
          }}
        />
      </div>
    </div>
  );
}
