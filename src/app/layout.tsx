import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider"; // Import the new provider
import { ConvexProvider } from "@/components/ConvexProvider";
import { SessionProvider } from "next-auth/react";
import { SoundProvider } from "@/context/SoundContext";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
})

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#7c3aed" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ECAST Academy",
  description: "AI-Powered Learning Platform - Learn smarter with personalized courses and capsules",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ECAST Academy",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "ECAST Academy",
    title: "ECAST Academy - AI-Powered Learning Platform",
    description: "Learn smarter with personalized courses and capsules powered by AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "ECAST Academy",
    description: "AI-Powered Learning Platform",
  },
  keywords: ["learning", "education", "AI", "courses", "online learning", "ECAST"],
  authors: [{ name: "ECAST Academy" }],
  creator: "ECAST Academy",
  publisher: "ECAST Academy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ECAST Academy" />
        <meta name="application-name" content="ECAST Academy" />
        <meta name="msapplication-TileColor" content="#7c3aed" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
          <ConvexProvider>
            <SoundProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem
                disableTransitionOnChange
              >
                <OfflineIndicator />
                {children}
                <Toaster />
                <InstallPrompt />
              </ThemeProvider>
            </SoundProvider>
          </ConvexProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
