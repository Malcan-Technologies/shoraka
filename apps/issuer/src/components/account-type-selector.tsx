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
import { BuildingOffice2Icon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { useOrganization, type CreateOrganizationInput, createApiClient, useAuthToken } from "@cashsouk/config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface AccountTypeSelectorProps {
  onBack: () => void;
}

type Step = "select-type" | "completing";
type ConfirmationType = "company" | null;

export function AccountTypeSelector({ onBack }: AccountTypeSelectorProps) {
  const router = useRouter();
  const { getAccessToken } = useAuthToken();
  const { createOrganization, startCorporateOnboarding, switchOrganization } = useOrganization();
  const [step, setStep] = React.useState<Step>("select-type");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmationType, setConfirmationType] = React.useState<ConfirmationType>(null);

  // Corporate onboarding form state
  const [companyName, setCompanyName] = React.useState("");
  const [formErrors, setFormErrors] = React.useState<{ companyName?: string }>({});

  const handleCompanyFormSubmit = () => {
    // Validate form
    const errors: { companyName?: string } = {};
    if (!companyName.trim()) {
      errors.companyName = "Company name is required";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    handleConfirmCompany(companyName.trim());
  };

  const handleConfirmCompany = async (companyNameValue: string) => {
    setConfirmationType(null);
    setIsSubmitting(true);
    setError(null);
    setStep("completing");

    try {
      // Log ONBOARDING_STARTED when user confirms company account creation
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        await apiClient.post("/v1/auth/start-onboarding", {
          role: "ISSUER",
        });
      } catch (logError) {
        // Log error but don't block the flow
        console.error("[AccountTypeSelector] Failed to log onboarding start:", logError);
      }

      const input: CreateOrganizationInput = {
        type: "COMPANY",
        name: companyNameValue,
      };
      const org = await createOrganization(input);
      
      // Start RegTank corporate onboarding for the new organization
      try {
        const { verifyLink } = await startCorporateOnboarding(org.id, companyNameValue);
        
        // Switch to the new organization
        switchOrganization(org.id);
        
        // Open RegTank portal in popup window
        window.open(verifyLink, "_blank");
        
        // Redirect to dashboard to show onboarding progress
        router.push("/");
      } catch (regTankError) {
        // Log full error for debugging
        console.error("[AccountTypeSelector] RegTank corporate onboarding failed:", regTankError);
        
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
      {/* Company Account Form Dialog */}
      <AlertDialog open={confirmationType === "company"} onOpenChange={(open) => {
        if (!open) {
          setConfirmationType(null);
          setCompanyName("");
          setFormErrors({});
        }
      }}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Create Company Account</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide the following information to start your company onboarding process.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                placeholder="e.g., Company A"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (formErrors.companyName) {
                    setFormErrors({ ...formErrors, companyName: undefined });
                  }
                }}
                disabled={isSubmitting}
                className={formErrors.companyName ? "border-destructive" : ""}
              />
              {formErrors.companyName && (
                <p className="text-sm text-destructive">{formErrors.companyName}</p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompanyFormSubmit} disabled={isSubmitting}>
              Create Company Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Create Company Account</h2>
          <p className="text-[15px] text-muted-foreground">
            Start your company onboarding to issue on CashSouk
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

        <button
          onClick={() => setConfirmationType("company")}
          disabled={isSubmitting}
          className="block text-left w-full"
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
                    Issue as a business entity
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
