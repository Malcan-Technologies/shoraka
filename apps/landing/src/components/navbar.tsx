"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Logo } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
          </Link>

          <div className="flex items-center gap-3">
            <a href={`${API_URL}/api/auth/login?role=INVESTOR`}>
              <Button variant="ghost" className="text-[15px]">
                Investor Login
              </Button>
            </a>
            <a href={`${API_URL}/api/auth/login?role=ISSUER`}>
              <Button variant="ghost" className="text-[15px]">
                Issuer Login
              </Button>
            </a>
            <Link href="/get-started">
              <Button className="bg-primary text-primary-foreground shadow-brand hover:opacity-95 text-[15px]">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

