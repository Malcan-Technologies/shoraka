import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { HELP_CENTER_URL } from "@cashsouk/config";
import { PlainChatWidget } from "@cashsouk/ui";
import "@cashsouk/styles/globals.css";
import "./globals.css";
import "../lib/amplify-config"; // Initialize Amplify

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "CashSouk - P2P Lending Platform",
  description: "Secure peer-to-peer lending platform connecting borrowers and investors",
  icons: {
    icon: "/shoraka_favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-user">
      <body className={inter.className}>
        {children}
        <PlainChatWidget appId={process.env.NEXT_PUBLIC_PLAIN_CHAT_APP_ID} helpCenterUrl={HELP_CENTER_URL} />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
