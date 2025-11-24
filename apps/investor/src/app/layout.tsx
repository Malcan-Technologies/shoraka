import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CashSouk Investor Portal",
  description: "Invest in verified loan opportunities",
  icons: {
    icon: "/cashsouk_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-investor">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
