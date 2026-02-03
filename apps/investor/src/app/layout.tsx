import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";
import { AppSidebar } from "../components/app-sidebar";
import { SidebarInset, SidebarProvider, Header } from "@cashsouk/ui";
import { Toaster } from "../components/ui/sonner";
import { Providers } from "../lib/providers";
import { AuthGuard } from "../components/auth-guard";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "CashSouk Investor Portal",
  description: "Invest in verified loan opportunities",
  icons: {
    icon: "/shoraka_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-investor">
      <body className={inter.className}>
        <Providers>
          <AuthGuard>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <Header />
                {children}
              </SidebarInset>
            </SidebarProvider>
            <Toaster />
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
