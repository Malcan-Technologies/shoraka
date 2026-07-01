import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";
import { AppSidebar } from "../components/app-sidebar";
import { CashSoukPortalFooter, Header, SidebarInset, SidebarProvider } from "@cashsouk/ui";
import { Toaster } from "../components/ui/sonner";
import { Providers } from "../lib/providers";
import { AuthGuard } from "../components/auth-guard";
import { OnboardingFeeReturnListener } from "../components/onboarding-fee-return-listener";

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
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="min-w-0 overflow-x-hidden">
                <Header />
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                <CashSoukPortalFooter variant="issuer" />
              </SidebarInset>
            </SidebarProvider>
            <Toaster />
            <Suspense fallback={null}>
              <OnboardingFeeReturnListener />
            </Suspense>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
