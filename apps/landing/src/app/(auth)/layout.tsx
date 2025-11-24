import * as React from "react";
import { Logo } from "@cashsouk/ui";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple header with logo */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex h-16 items-center">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
            </Link>
          </div>
        </div>
      </header>

      {/* Auth content - centered */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm md:max-w-4xl">{children}</div>
      </main>

      {/* Simple footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-6 py-6">
          <div className="flex justify-center gap-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Contact
            </a>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            © 2024 CashSouk. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
