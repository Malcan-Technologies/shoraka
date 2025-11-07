"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Logo } from "@shoraka/ui";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
          </Link>

          <div className="flex items-center gap-2">
            <Link href="http://localhost:3001" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="text-[17px]">
                For Borrowers
              </Button>
            </Link>
            <Link href="http://localhost:3002" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="text-[17px]">
                For Investors
              </Button>
            </Link>
            <div className="ml-2 flex gap-2">
              <Link href="http://localhost:3002" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="text-[17px]">
                  Sign In
                </Button>
              </Link>
              <Link href="http://localhost:3001" target="_blank" rel="noopener noreferrer">
                <Button className="bg-primary text-primary-foreground shadow-brand hover:opacity-95 text-[17px]">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

