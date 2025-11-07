import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@shoraka/styles/globals.css";
import "./globals.css";
import { DashboardLayout } from "../components/dashboard-layout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shoraka Admin Dashboard",
  description: "Manage loans, users, and platform operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="theme-admin">
      <body className={inter.className}>
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  );
}

