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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface RoleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleSelectionModal({ open, onOpenChange }: RoleSelectionModalProps) {
  const handleRoleSelect = (role: "INVESTOR" | "ISSUER") => {
    window.location.href = `${API_URL}/api/auth/login?role=${role}`;
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
            className="h-auto p-4 flex items-center gap-3 justify-start"
            onClick={() => handleRoleSelect("INVESTOR")}
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BuildingLibraryIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-semibold">Investor</div>
              <div className="text-sm text-muted-foreground">Sign in as an investor</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto p-4 flex items-center gap-3 justify-start"
            onClick={() => handleRoleSelect("ISSUER")}
          >
            <div className="h-10 w-10 rounded-lg bg-secondary/30 flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="text-left">
              <div className="font-semibold">Issuer</div>
              <div className="text-sm text-muted-foreground">Sign in as an issuer</div>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

