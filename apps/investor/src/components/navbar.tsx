"use client";

import * as React from "react";
import { Button, Logo } from "@cashsouk/ui";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { getAuthToken } from "../lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function Navbar() {
  const handleSignOut = () => {
    const token = getAuthToken();
    const logoutUrl = new URL(`${API_URL}/api/auth/logout`);
    if (token) {
      logoutUrl.searchParams.set("token", token);
    }
    // Clear token from localStorage before redirecting
    localStorage.removeItem("auth_token");
    window.location.href = logoutUrl.toString();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-sm font-medium text-muted-foreground">Investor Portal</span>
          </div>

          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="flex items-center gap-2 text-[15px]"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}

