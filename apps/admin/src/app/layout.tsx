import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";
import { AppSidebar } from "../components/app-sidebar";
import { SidebarInset, SidebarProvider } from "../components/ui/sidebar";
import { Toaster } from "../components/ui/sonner";
import { Providers } from "../lib/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CashSouk Admin Dashboard",
  description: "Manage loans, users, and platform operations",
  icons: {
    icon: "/cashsouk_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-admin">
      <body className={inter.className}>
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {children}
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
