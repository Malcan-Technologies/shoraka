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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@cashsouk/ui";
import { ScrollArea } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function GetStartedPageContent() {
  const searchParams = useSearchParams();
  const [showSignInModal, setShowSignInModal] = React.useState(false);
  const [showShariah, setShowShariah] = React.useState(false);
  const [canContinue, setCanContinue] = React.useState(false);
  const error = searchParams.get("error");
  const errorMessage = searchParams.get("message");

  const handleRoleSelect = (role: "INVESTOR" | "ISSUER") => {
    window.location.href = `${API_URL}/api/auth/login?role=${role}&signup=true`;
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Get Started</h1>
        <p className="text-[15px] text-muted-foreground">Choose how you&apos;d like to join CashSouk</p>
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
                  <CardTitle className="text-lg">I&apos;m an Investor</CardTitle>
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

        <button onClick={() => setShowShariah(true)} className="block text-left">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-secondary/30 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">I&apos;m an Issuer</CardTitle>
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
          Can&apos;t sign in?{" "}
          <a href="/verify-email-help" className="text-primary hover:underline font-medium">
            Verify your email
          </a>
        </p>
      </div>

      <RoleSelectionModal open={showSignInModal} onOpenChange={setShowSignInModal} />
      {/* Shariah Compliance modal */}
      <AlertDialog
        open={showShariah}
        onOpenChange={(open) => {
          setShowShariah(open);
          if (!open) setCanContinue(false);
        }}
      >
        <AlertDialogContent className="w-full max-w-[92vw] sm:max-w-[640px] md:max-w-[820px] lg:max-w-[940px] px-4 sm:px-6 py-4 sm:py-6 rounded-[18px] shadow-[0_25px_60px_rgba(0,0,0,0.25)] bg-card">
          <AlertDialogHeader>
            <div className="w-full flex items-start justify-between gap-4">
              <div>
                <AlertDialogTitle className="text-[20px] font-bold">Shariah Compliance Requirement Notice</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
                  Please read the following carefully.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <ScrollArea
            className="rounded-md border p-4 sm:p-6 h-[300px] sm:h-[420px] md:h-[520px] lg:h-[640px]"
            onScroll={(e) => {
              const el = e.currentTarget;
              const tolerance = 8;
              if (el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance) {
                setCanContinue(true);
              }
            }}
          >
            <div className="h-full overflow-auto pr-4 text-sm sm:text-[17px] leading-7 text-foreground">
              <div className="space-y-6 sm:space-y-5">
                <p className="mb-0">CashSouk operates as a fully Shariah-compliant financing platform.</p>

                <p className="mb-0">
                  Before proceeding to sign-up, please note that all issuer applications are
                  subject to a mandatory Shariah screening and financial ratio assessment as part of
                  our onboarding and approval process.
                </p>

                <div>
                  <p className="mb-2">Businesses that are primarily involved in non-Shariah-compliant activities including but not limited to:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-2">
                    <li>Conventional banking or interest-based lending;</li>
                    <li>Conventional insurance;</li>
                    <li>Gambling;</li>
                    <li>Liquor or liquor-related activities;</li>
                    <li>Pork or pork-related activities;</li>
                    <li>Non-halal food and beverages;</li>
                    <li>Tobacco or tobacco-related activities;</li>
                    <li>Shariah non-compliant entertainment;</li>
                    <li>Interest (riba)-based income or investments; or</li>
                    <li>Any other activities deemed non-compliant by the relevant Shariah authorities</li>
                  </ul>
                </div>

                <p className="mb-0">These businesses may not qualify for listing on the platform.</p>

                <div>
                  <p className="mb-2">In addition, businesses with significant exposure to:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-2">
                    <li>Revenue derived from non-compliant activities,</li>
                    <li>Cash placed in conventional interest-bearing accounts, or</li>
                    <li>Interest-bearing debt,</li>
                  </ul>
                </div>

                <p className="mb-0">Such businesses may not meet our Shariah screening benchmarks.</p>

                <p className="mb-0">
                  If your business may fall within any of the above categories, you are advised not
                  to proceed with registration.
                </p>

                <p className="mb-0">
                  By continuing to the sign-up page, you acknowledge that your application will undergo
                  Shariah screening and that approval is subject to meeting our compliance requirements.
                </p>
              </div>
            </div>
          </ScrollArea>

          <AlertDialogFooter className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-end w-full gap-4">
              <AlertDialogCancel className="px-4 py-2">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="px-6 py-2"
                disabled={!canContinue}
                onClick={() => {
                  setShowShariah(false);
                  handleRoleSelect("ISSUER");
                }}
              >
                I Acknowledge & Continue
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
