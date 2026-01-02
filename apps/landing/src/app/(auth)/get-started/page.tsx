"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@cashsouk/ui";
import {
  UserIcon,
  BuildingLibraryIcon,
  ExclamationCircleIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { RoleSelectionModal } from "../../../components/role-selection-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function GetStartedPageContent() {
  const searchParams = useSearchParams();
  const [showSignInModal, setShowSignInModal] = React.useState(false);
  const error = searchParams.get("error");
  const errorMessage = searchParams.get("message");

  const handleRoleSelect = (role: "INVESTOR" | "ISSUER") => {
    window.location.href = `${API_URL}/api/auth/login?role=${role}&signup=true`;
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Get Started</h1>
        <p className="text-[15px] text-muted-foreground">Choose how you'd like to join CashSouk</p>
      </div>

      {error === "user_exists" && errorMessage && (
        <div className="w-full max-w-xl rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-1">Account Already Exists</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSignInModal(true)}
                className="mt-3"
              >
                Sign In Instead
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-xl grid gap-4">
        <button onClick={() => handleRoleSelect("INVESTOR")} className="block text-left">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BuildingLibraryIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">I'm an Investor</CardTitle>
                  <CardDescription className="text-sm">
                    Invest in verified borrowers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Earn competitive returns by funding loans from our curated borrower pool.
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary/80">
                  <MapPinIcon className="h-3 w-3" />
                  Malaysian citizens & Malaysia-registered entities
                </span>
              </div>
            </CardContent>
          </Card>
        </button>

        <button onClick={() => handleRoleSelect("ISSUER")} className="block text-left">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-secondary/30 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">I'm an Issuer</CardTitle>
                  <CardDescription className="text-sm">Get funding for your needs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Apply for a loan with flexible terms and transparent rates.
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs text-secondary-foreground/70">
                  <MapPinIcon className="h-3 w-3" />
                  Malaysia-registered entities only
                </span>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <button
            onClick={() => setShowSignInModal(true)}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          Can't sign in?{" "}
          <a href="/verify-email-help" className="text-primary hover:underline font-medium">
            Verify your email
          </a>
        </p>
      </div>

      <RoleSelectionModal open={showSignInModal} onOpenChange={setShowSignInModal} />
    </div>
  );
}

export default function GetStartedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <GetStartedPageContent />
    </Suspense>
  );
}
