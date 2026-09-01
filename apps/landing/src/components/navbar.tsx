"use client";

import * as React from "react";
import Link from "next/link";
import { Bars3Icon } from "@heroicons/react/24/outline";
import {
  Button,
  Logo,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@cashsouk/ui";
import { RoleSelectionModal } from "./role-selection-modal";

export function Navbar() {
  const [showLoginModal, setShowLoginModal] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink items-center">
          <Logo size={40} />
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/marketplace"
            className="text-[15px] font-medium text-foreground hover:text-primary"
          >
            Marketplace
          </Link>
          <Button
            variant="ghost"
            className="h-10 px-4 text-[15px] hover:bg-transparent hover:text-primary"
            onClick={() => {
              setShowLoginModal(true);
            }}
          >
            Login
          </Button>
          <Button asChild className="h-10 bg-primary px-4 text-[15px] text-primary-foreground shadow-brand hover:opacity-95">
            <Link href="/get-started">Get Started</Link>
          </Button>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 md:hidden"
              aria-label="Open menu"
            >
              <Bars3Icon className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-6"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Marketplace, login, and get started
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3">
              <Link
                href="/marketplace"
                className="rounded-lg px-2 py-2 text-[15px] font-medium text-foreground hover:bg-muted hover:text-primary"
                onClick={() => setMenuOpen(false)}
              >
                Marketplace
              </Link>
              <Button
                variant="ghost"
                className="h-11 justify-start px-2 text-[15px] hover:bg-muted hover:text-primary"
                onClick={() => {
                  setMenuOpen(false);
                  setShowLoginModal(true);
                }}
              >
                Login
              </Button>
              <Button asChild className="h-11 bg-primary text-[15px] text-primary-foreground shadow-brand">
                <Link href="/get-started" onClick={() => setMenuOpen(false)}>
                  Get Started
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <RoleSelectionModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </nav>
  );
}
