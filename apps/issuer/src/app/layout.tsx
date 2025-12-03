import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@cashsouk/styles/globals.css";
import "./globals.css";
import { Navbar } from "../components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CashSouk Issuer Portal",
  description: "Apply for loans quickly and securely",
  icons: {
    icon: "/cashsouk_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-issuer">
      <body className={inter.className}>
        <Navbar />
        <div className="pt-16">{children}</div>
      </body>
    </html>
  );
}
