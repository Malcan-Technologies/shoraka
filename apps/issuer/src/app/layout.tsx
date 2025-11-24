import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CashSouk Borrower Portal",
  description: "Apply for loans quickly and securely",
  icons: {
    icon: "/cashsouk_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-borrower">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
