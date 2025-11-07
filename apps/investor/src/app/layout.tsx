import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@shoraka/styles/globals.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shoraka Investor Portal",
  description: "Invest in verified loan opportunities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="theme-investor">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

