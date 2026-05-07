"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Logo } from "@cashsouk/ui";
import { RoleSelectionModal } from "./role-selection-modal";

export function Navbar() {
  const [showLoginModal, setShowLoginModal] = React.useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Logo />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/marketplace"
            className="text-sm font-medium text-foreground hover:text-primary sm:text-[15px]"
          >
            Marketplace
          </Link>
          <Button
            variant="ghost"
            className="text-sm hover:bg-transparent hover:text-primary sm:text-[15px]"
            onClick={() => {
              setShowLoginModal(true);
            }}
          >
            Login
          </Button>
          <Link href="/get-started">
            <Button className="bg-primary text-primary-foreground shadow-brand hover:opacity-95 text-sm sm:text-[15px]">
              Get Started
            </Button>
          </Link>
        </div>
      </div>

      <RoleSelectionModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </nav>
  );
}
