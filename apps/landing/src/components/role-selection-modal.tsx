"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Button,
} from "@cashsouk/ui";
import { BuildingLibraryIcon, UserIcon } from "@heroicons/react/24/outline";

const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";
const ISSUER_URL = process.env.NEXT_PUBLIC_ISSUER_URL || "http://localhost:3001";

interface RoleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleSelectionModal({ open, onOpenChange }: RoleSelectionModalProps) {
  const handleRoleSelect = (role: "INVESTOR" | "ISSUER") => {
    window.location.href = role === "INVESTOR" ? INVESTOR_URL : ISSUER_URL;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sign in as</SheetTitle>
          <SheetDescription>Choose how you'd like to sign in</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto p-4 flex items-center gap-3 justify-start group"
            onClick={() => handleRoleSelect("INVESTOR")}
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-active:bg-primary/20">
              <BuildingLibraryIcon className="h-5 w-5 text-primary group-hover:text-primary-foreground group-active:text-primary-foreground" />
            </div>
            <div className="text-left">
              <div className="font-semibold group-hover:text-primary-foreground group-active:text-primary-foreground">
                Investor
              </div>
              <div className="text-sm text-muted-foreground group-hover:text-primary-foreground/90 group-active:text-primary-foreground/90">
                Sign in as an investor
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto p-4 flex items-center gap-3 justify-start group"
            onClick={() => handleRoleSelect("ISSUER")}
          >
            <div className="h-10 w-10 rounded-lg bg-secondary/30 flex items-center justify-center group-hover:bg-primary/20 group-active:bg-primary/20">
              <UserIcon className="h-5 w-5 text-secondary-foreground group-hover:text-primary-foreground group-active:text-primary-foreground" />
            </div>
            <div className="text-left">
              <div className="font-semibold group-hover:text-primary-foreground group-active:text-primary-foreground">
                Issuer
              </div>
              <div className="text-sm text-muted-foreground group-hover:text-primary-foreground/90 group-active:text-primary-foreground/90">
                Sign in as an issuer
              </div>
            </div>
          </Button>
        </div>

        <div className="border-t pt-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Having trouble signing in?
          </p>
          <Button
            variant="link"
            className="text-sm"
            onClick={() => {
              onOpenChange(false);
              window.location.href = "/verify-email-help";
            }}
          >
            Verify your email address
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
