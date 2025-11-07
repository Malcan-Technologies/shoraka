import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@shoraka/styles/globals.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shoraka Borrower Portal",
  description: "Apply for loans quickly and securely",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="theme-borrower">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

