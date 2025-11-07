import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@shoraka/styles/globals.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shoraka - P2P Lending Platform",
  description: "Secure peer-to-peer lending platform connecting borrowers and investors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="theme-user">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

