import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";
import { AppSidebar } from "../components/app-sidebar";
import { AdminHeader } from "../components/admin-header";
import { AdminHeaderChrome } from "../components/admin-header-chrome";
import { SidebarInset, SidebarProvider } from "../components/ui/sidebar";
import { Toaster } from "../components/ui/sonner";
import { Providers } from "../lib/providers";
import { AuthGuard } from "../components/auth-guard";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "CashSouk Admin Dashboard",
  description: "Manage financing, users, and platform operations",
  icons: {
    icon: "/shoraka_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-admin">
      <body className={inter.className}>
        <Providers>
          <AuthGuard>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="min-w-0 overflow-x-hidden">
                <AdminHeader rightContent={<AdminHeaderChrome />} />
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
              </SidebarInset>
            </SidebarProvider>
            <Toaster />
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
