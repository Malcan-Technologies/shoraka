"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@cashsouk/ui";
import { UserIcon, BuildingOffice2Icon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { useOrganization, type CreateOrganizationInput } from "@cashsouk/config";

interface AccountTypeSelectorProps {
  onBack: () => void;
}

type Step = "select-type" | "completing";
type ConfirmationType = "personal" | "company" | null;

/**
 * Generate the next company name based on existing companies
 * Returns "Company A", "Company B", etc.
 */
function getNextCompanyName(existingCompanyCount: number): string {
  const letter = String.fromCharCode(65 + existingCompanyCount); // A=65, B=66, etc.
  return `Company ${letter}`;
}

export function AccountTypeSelector({ onBack }: AccountTypeSelectorProps) {
  const { hasPersonalOrganization, organizations, createOrganization, startRegTankOnboarding } = useOrganization();
  const [step, setStep] = React.useState<Step>("select-type");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmationType, setConfirmationType] = React.useState<ConfirmationType>(null);

  // Count existing company organizations
  const companyCount = React.useMemo(() => {
    return organizations.filter(org => org.type === "COMPANY").length;
  }, [organizations]);

  const nextCompanyName = React.useMemo(() => {
    return getNextCompanyName(companyCount);
  }, [companyCount]);

  const handleConfirmPersonal = async () => {
    setConfirmationType(null);
    setIsSubmitting(true);
    setError(null);
    setStep("completing");

    try {
      const input: CreateOrganizationInput = { type: "PERSONAL" };
      const org = await createOrganization(input);
      
      // Start RegTank onboarding for the new organization
      try {
        const { verifyLink } = await startRegTankOnboarding(org.id);
        
        // Redirect to RegTank portal
        window.location.href = verifyLink;
      } catch (regTankError) {
        // Log full error for debugging
        console.error("[AccountTypeSelector] RegTank onboarding failed:", regTankError);
        
        // Extract error message
        let errorMessage = "Failed to start identity verification";
        if (regTankError instanceof Error) {
          errorMessage = regTankError.message;
        } else if (typeof regTankError === "object" && regTankError !== null) {
          const err = regTankError as { message?: string; error?: { message?: string } };
          errorMessage = err.message || err.error?.message || errorMessage;
        }
        
        setError(errorMessage);
        setStep("select-type");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("[AccountTypeSelector] Failed to create personal account:", err);
      setError(err instanceof Error ? err.message : "Failed to create personal account");
      setStep("select-type");
      setIsSubmitting(false);
    }
  };

  const handleConfirmCompany = async () => {
    setConfirmationType(null);
    setIsSubmitting(true);
    setError(null);
    setStep("completing");

    try {
      // Auto-generate company name
      const companyName = nextCompanyName;
      
      const input: CreateOrganizationInput = {
        type: "COMPANY",
        name: companyName,
      };
      const org = await createOrganization(input);
      
      // Start RegTank onboarding for the new organization
      try {
        const { verifyLink } = await startRegTankOnboarding(org.id);
        
        // Redirect to RegTank portal
        window.location.href = verifyLink;
      } catch (regTankError) {
        // Log full error for debugging
        console.error("[AccountTypeSelector] RegTank onboarding failed:", regTankError);
        
        // Extract error message
        let errorMessage = "Failed to start identity verification";
        if (regTankError instanceof Error) {
          errorMessage = regTankError.message;
        } else if (typeof regTankError === "object" && regTankError !== null) {
          const err = regTankError as { message?: string; error?: { message?: string } };
          errorMessage = err.message || err.error?.message || errorMessage;
        }
        
        setError(errorMessage);
        setStep("select-type");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("[AccountTypeSelector] Failed to create company account:", err);
      setError(err instanceof Error ? err.message : "Failed to create company account");
      setStep("select-type");
      setIsSubmitting(false);
    }
  };

  if (step === "completing") {
    return (
      <div className="w-full max-w-xl">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <CheckCircleIcon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Setting up your account...</h2>
            <p className="text-[15px] text-muted-foreground">
              This will only take a moment
            </p>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Personal Account Confirmation Dialog */}
      <AlertDialog open={confirmationType === "personal"} onOpenChange={(open) => !open && setConfirmationType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Personal Account?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to create a <strong>Personal Account</strong> for investing on CashSouk.
              <br /><br />
              This account type is for individuals who want to invest as themselves. You can only have one personal account.
              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPersonal}>
              Yes, Create Personal Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Company Account Confirmation Dialog */}
      <AlertDialog open={confirmationType === "company"} onOpenChange={(open) => !open && setConfirmationType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Company Account?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to create a <strong>Company Account</strong> for investing on CashSouk.
              <br /><br />
              This account will be named <strong>"{nextCompanyName}"</strong> for testing purposes.
              <br /><br />
              Company accounts are for businesses, partnerships, or other entities. You can create multiple company accounts.
              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCompany}>
              Yes, Create Company Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Choose Account Type</h2>
          <p className="text-[15px] text-muted-foreground">
            Select how you'd like to invest on CashSouk
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          <button
            onClick={() => setConfirmationType("personal")}
            disabled={hasPersonalOrganization || isSubmitting}
            className="block text-left disabled:cursor-not-allowed"
          >
            <Card
              className={`transition-all ${
                hasPersonalOrganization
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:shadow-md hover:border-primary/50"
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Personal Account</CardTitle>
                    <CardDescription className="text-sm">
                      Invest as an individual
                    </CardDescription>
                  </div>
                  {hasPersonalOrganization && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                      Already created
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Perfect for individual investors. You can only have one personal account.
                </p>
              </CardContent>
            </Card>
          </button>

          <button
            onClick={() => setConfirmationType("company")}
            disabled={isSubmitting}
            className="block text-left"
          >
            <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-secondary/30 flex items-center justify-center">
                    <BuildingOffice2Icon className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Company Account</CardTitle>
                    <CardDescription className="text-sm">
                      Invest as a business entity
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  For companies, partnerships, or other business entities. You can create multiple company accounts.
                </p>
              </CardContent>
            </Card>
          </button>
        </div>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    </>
  );
}
