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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

interface AccountTypeSelectorProps {
  onBack: () => void;
  onCorporateOnboardingStart?: (organizationId: string) => void;
}

type Step = "select-type" | "completing";
type ConfirmationType = "personal" | "company" | null;

export function AccountTypeSelector({ onBack, onCorporateOnboardingStart }: AccountTypeSelectorProps) {
  const router = useRouter();
  const { hasPersonalOrganization, organizations, createOrganization, startRegTankOnboarding, startIndividualOnboarding, startCorporateOnboarding, switchOrganization } = useOrganization();
  const [step, setStep] = React.useState<Step>("select-type");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmationType, setConfirmationType] = React.useState<ConfirmationType>(null);

  // Corporate onboarding form state
  const [companyName, setCompanyName] = React.useState("");
  const [formErrors, setFormErrors] = React.useState<{ companyName?: string }>({});

  // Find personal organization to check if onboarding can be resumed
  const personalOrganization = React.useMemo(() => {
    return organizations.find(org => org.type === "PERSONAL");
  }, [organizations]);

  // Allow restarting if status is PENDING (admin requested redo via restart)
  // This happens when admin clicks "Restart Onboarding" in the admin portal
  const canRestartPersonalOnboarding = React.useMemo(() => {
    return personalOrganization?.onboardingStatus === "PENDING";
  }, [personalOrganization]);

  // Personal account button should be disabled if:
  // - Personal org exists AND status is NOT PENDING (cannot restart)
  // - OR if currently submitting
  // Allow if: no org exists, or status is PENDING (admin restart - user can click to resume)
  const isPersonalAccountDisabled = React.useMemo(() => {
    if (isSubmitting) return true;
    if (!hasPersonalOrganization) return false;
    // Allow if status is PENDING (admin restart)
    return !canRestartPersonalOnboarding;
  }, [hasPersonalOrganization, canRestartPersonalOnboarding, isSubmitting]);

  const handleConfirmPersonal = async () => {
    setConfirmationType(null);
    setIsSubmitting(true);
    setError(null);
    setStep("completing");

    try {
      // Check if personal organization already exists
      const existingPersonalOrg = organizations.find(org => org.type === "PERSONAL");
      
      let org;
      if (existingPersonalOrg) {
        // Use existing personal organization
        org = existingPersonalOrg;
      } else {
        // Create new personal organization
        const input: CreateOrganizationInput = { type: "PERSONAL" };
        org = await createOrganization(input);
      }
      
      // Start RegTank individual onboarding for the organization
      // Backend will check for existing active onboarding and resume if found
      try {
        const { verifyLink } = startIndividualOnboarding 
          ? await startIndividualOnboarding(org.id)
          : await startRegTankOnboarding(org.id);
        
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
      const input: CreateOrganizationInput = {
        type: "COMPANY",
        name: companyNameValue,
      };
      const org = await createOrganization(input);
      
      // Start RegTank corporate onboarding for the new organization
      try {
        const { verifyLink } = startCorporateOnboarding 
          ? await startCorporateOnboarding(org.id, companyNameValue)
          : await startRegTankOnboarding(org.id);
        
        // Switch to the new organization
        switchOrganization(org.id);
        
        // Open RegTank portal in popup window
        window.open(verifyLink, "_blank");
        
        // Redirect to dashboard to show onboarding progress
        router.push("/");
        
        // Notify parent component
        if (onCorporateOnboardingStart) {
          onCorporateOnboardingStart(org.id);
        }
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
        setStep("select-type");
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
            <AlertDialogTitle>
              {canRestartPersonalOnboarding ? "Restart Onboarding?" : "Create Personal Account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {canRestartPersonalOnboarding ? (
                <>
                  Your previous onboarding was reset by an administrator.
                  <br /><br />
                  Clicking continue will start a fresh identity verification process for your <strong>Personal Account</strong>.
                  <br /><br />
                  Do you want to continue?
                </>
              ) : (
                <>
                  You are about to create a <strong>Personal Account</strong> for investing on CashSouk.
                  <br /><br />
                  This account type is for individuals who want to invest as themselves. You can only have one personal account.
                  <br /><br />
                  Are you sure you want to continue?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPersonal}>
              {canRestartPersonalOnboarding ? "Yes, Restart Onboarding" : "Yes, Create Personal Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            disabled={isPersonalAccountDisabled}
            className="block text-left disabled:cursor-not-allowed"
          >
            <Card
              className={`transition-all ${
                isPersonalAccountDisabled
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
                      {canRestartPersonalOnboarding 
                        ? "Restart your onboarding" 
                        : "Invest as an individual"}
                    </CardDescription>
                  </div>
                  {hasPersonalOrganization && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      canRestartPersonalOnboarding
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {canRestartPersonalOnboarding 
                        ? "Restart required" 
                        : "Already created"}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {canRestartPersonalOnboarding
                    ? "Your previous onboarding was reset. Click to start fresh with identity verification."
                    : "Perfect for individual investors. You can only have one personal account."}
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
