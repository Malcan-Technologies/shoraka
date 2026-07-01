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
import {
  useOrganization,
  type CreateOrganizationInput,
  createApiClient,
  useAuthToken,
} from "@cashsouk/config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface AccountTypeSelectorProps {
  onBack: () => void;
}

type Step = "select-type" | "completing";

export function AccountTypeSelector({ onBack }: AccountTypeSelectorProps) {
  const router = useRouter();
  const { getAccessToken } = useAuthToken();
  const { createOrganization, switchOrganization } = useOrganization();
  const [step, setStep] = React.useState<Step>("select-type");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showCompanyDialog, setShowCompanyDialog] = React.useState(false);
  const [companyName, setCompanyName] = React.useState("");
  const [formErrors, setFormErrors] = React.useState<{ companyName?: string }>({});

  const handleConfirmCompany = async (companyNameValue: string) => {
    setShowCompanyDialog(false);
    setIsSubmitting(true);
    setError(null);
    setStep("completing");

    try {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        await apiClient.post("/v1/auth/start-onboarding", { role: "ISSUER" });
      } catch (logError) {
        console.error("[AccountTypeSelector] Failed to log onboarding start:", logError);
      }

      const input: CreateOrganizationInput = {
        type: "COMPANY",
        name: companyNameValue,
      };
      const org = await createOrganization(input);
      switchOrganization(org.id);
      router.push("/onboarding/terms");
    } catch (err) {
      console.error("[AccountTypeSelector] Failed to create company account:", err);
      setError(err instanceof Error ? err.message : "Failed to create company account");
      setStep("select-type");
      setIsSubmitting(false);
    }
  };

  const handleCompanyFormSubmit = () => {
    const errors: { companyName?: string } = {};
    if (!companyName.trim()) {
      errors.companyName = "Company name is required";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    void handleConfirmCompany(companyName.trim());
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
            <p className="text-[15px] text-muted-foreground">This will only take a moment</p>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog
        open={showCompanyDialog}
        onOpenChange={(open) => {
          setShowCompanyDialog(open);
          if (!open) {
            setCompanyName("");
            setFormErrors({});
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Create Company Account</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide your company name to start onboarding.
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
              {formErrors.companyName ? (
                <p className="text-sm text-destructive">{formErrors.companyName}</p>
              ) : null}
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
          <h2 className="text-xl font-semibold">Company Account</h2>
          <p className="text-[15px] text-muted-foreground">
            Issuer accounts are for registered business entities
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowCompanyDialog(true)}
          disabled={isSubmitting}
          className="block w-full text-left"
        >
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-secondary/30 flex items-center justify-center">
                  <BuildingOffice2Icon className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Create company account</CardTitle>
                  <CardDescription className="text-sm">
                    Apply for financing as a business
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You can create multiple company accounts for different entities.
              </p>
            </CardContent>
          </Card>
        </button>

        <div className="text-center">
          <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    </>
  );
}
