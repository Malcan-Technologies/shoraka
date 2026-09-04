import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";
import { Toaster } from "../components/ui/sonner";
import { Providers } from "../lib/providers";
import { AuthGuard } from "../components/auth-guard";
import { PortalChrome } from "../components/portal-chrome";
import { OnboardingFeeReturnListener } from "../components/onboarding-fee-return-listener";
import { SupportChat } from "../components/support-chat";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "CashSouk Issuer Portal",
  description: "Apply for financing quickly and securely",
  icons: {
    icon: "/shoraka_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-issuer">
      <body className={inter.className}>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <Providers>
          <AuthGuard>
            <PortalChrome>{children}</PortalChrome>
            <Toaster />
            <SupportChat />
            <Suspense fallback={null}>
              <OnboardingFeeReturnListener />
            </Suspense>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
