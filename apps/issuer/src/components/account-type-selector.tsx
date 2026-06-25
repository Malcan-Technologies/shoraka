"use client";

import * as React from "react";
import { toast } from "sonner";
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
  buildIssuerOnboardingFeeCallbackUrl,
  openCurlecFpxCheckout,
} from "@cashsouk/config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import {
  storeIssuerPendingOnboarding,
  useCreateIssuerOnboardingFeeMutation,
  useIssuerOnboardingFeeQuery,
} from "@/hooks/use-issuer-onboarding-fee";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface AccountTypeSelectorProps {
  onBack: () => void;
}

type Step = "select-type" | "completing" | "pay-fee";

type ConfirmationType = "company" | null;

function resolveCheckoutContact(
  activeOrganization: ReturnType<typeof useOrganization>["activeOrganization"]
) {
  if (!activeOrganization) {
    return { email: "", contact: "", name: undefined as string | undefined };
  }

  const member =
    activeOrganization.members.find((entry) => entry.role === "ORGANIZATION_ADMIN") ??
    activeOrganization.members[0];

  const name =
    activeOrganization.firstName && activeOrganization.lastName
      ? `${activeOrganization.firstName} ${activeOrganization.lastName}`
      : activeOrganization.name ?? undefined;

  return {
    email: member?.email ?? "",
    contact: activeOrganization.phoneNumber?.trim() || "+60000000000",
    name,
  };
}

export function AccountTypeSelector({ onBack }: AccountTypeSelectorProps) {
  const router = useRouter();
  const { getAccessToken } = useAuthToken();
  const { activeOrganization, createOrganization, startCorporateOnboarding, switchOrganization } =
    useOrganization();
  const createFee = useCreateIssuerOnboardingFeeMutation();
  const [step, setStep] = React.useState<Step>("select-type");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmationType, setConfirmationType] = React.useState<ConfirmationType>(null);
  const [companyName, setCompanyName] = React.useState("");
  const [confirmedCompanyName, setConfirmedCompanyName] = React.useState("");
  const [formErrors, setFormErrors] = React.useState<{ companyName?: string }>({});
  const [createdOrgId, setCreatedOrgId] = React.useState<string | null>(null);
  const [feePaymentId, setFeePaymentId] = React.useState<string | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);

  const feeQuery = useIssuerOnboardingFeeQuery(feePaymentId ?? undefined);

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

  const proceedToRegTank = async (orgId: string, companyNameValue: string) => {
    const { verifyLink } = await startCorporateOnboarding(orgId, companyNameValue);
    switchOrganization(orgId);
    window.open(verifyLink, "_blank");
    router.push("/");
  };

  const handleConfirmCompany = async (companyNameValue: string) => {
    setConfirmationType(null);
    setConfirmedCompanyName(companyNameValue);
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
      setCreatedOrgId(org.id);

      const fee = await createFee.mutateAsync({ issuerOrganizationId: org.id });
      setFeePaymentId(fee.id);

      if (fee.status === "COMPLETED") {
        await proceedToRegTank(org.id, companyNameValue);
        return;
      }

      setStep("pay-fee");
      setIsSubmitting(false);
    } catch (err) {
      console.error("[AccountTypeSelector] Failed to create company account:", err);
      setError(err instanceof Error ? err.message : "Failed to create company account");
      setStep("select-type");
      setIsSubmitting(false);
    }
  };

  const handlePayFee = async () => {
    const companyNameValue = confirmedCompanyName.trim();
    if (!createdOrgId || !companyNameValue) {
      toast.error("Missing organization details");
      return;
    }

    let checkoutContact = resolveCheckoutContact(activeOrganization);
    if (!checkoutContact.email) {
      const apiClient = createApiClient(API_URL, getAccessToken);
      const me = await apiClient.get<{
        user: { email: string; first_name?: string; last_name?: string };
      }>("/v1/auth/me");
      if (me.success && me.data.user.email) {
        checkoutContact = {
          email: me.data.user.email,
          contact: checkoutContact.contact || "+60000000000",
          name:
            checkoutContact.name ??
            ([me.data.user.first_name, me.data.user.last_name].filter(Boolean).join(" ") ||
              companyNameValue),
        };
      }
    }

    if (!checkoutContact.email) {
      toast.error("We could not find an email address for this account");
      return;
    }

    try {
      setIsOpeningCheckout(true);
      setError(null);

      const fee =
        feeQuery.data ??
        (await createFee.mutateAsync({ issuerOrganizationId: createdOrgId }));

      if (fee.status === "COMPLETED") {
        await proceedToRegTank(createdOrgId, companyNameValue);
        return;
      }

      storeIssuerPendingOnboarding({ orgId: createdOrgId, companyName: companyNameValue });

      const callbackUrl = buildIssuerOnboardingFeeCallbackUrl(fee.id, "/onboarding-start");

      await openCurlecFpxCheckout({
        keyId: fee.curlecKeyId,
        orderId: fee.curlecOrderId,
        amountMyr: fee.amount,
        callbackUrl,
        description: "Issuer onboarding fee",
        prefillName: checkoutContact.name,
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
        onDismiss: () => setIsOpeningCheckout(false),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start payment";
      if (message.includes("ONBOARDING_FEE_REQUIRED")) {
        setError("Please complete the onboarding fee before continuing.");
      } else {
        setError(message);
      }
    } finally {
      setIsOpeningCheckout(false);
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
            <p className="text-[15px] text-muted-foreground">This will only take a moment</p>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (step === "pay-fee") {
    const feeAmount = feeQuery.data?.amount ?? createFee.data?.amount;

    return (
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Pay onboarding fee</h2>
          <p className="text-[15px] text-muted-foreground">
            A one-time fee is required before starting company verification (eKYB).
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

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Issuer onboarding fee</CardTitle>
            <CardDescription>
              {confirmedCompanyName ? `For ${confirmedCompanyName}` : "Company account setup"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">Amount due</p>
              <p className="text-2xl font-semibold tabular-nums">
                RM {feeAmount != null ? feeAmount.toFixed(2) : "—"}
              </p>
            </div>
            <Button
              type="button"
              variant="action"
              className="h-11 w-full rounded-xl"
              disabled={isOpeningCheckout || createFee.isPending || feeAmount == null}
              onClick={() => void handlePayFee()}
            >
              {isOpeningCheckout ? "Opening checkout..." : "Pay with FPX"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              This fee is non-refundable and unlocks eKYB verification for your company account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <AlertDialog
        open={confirmationType === "company"}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setConfirmationType(null);
            setCompanyName("");
            setFormErrors({});
          }
        }}
      >
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
                For companies, partnerships, or other business entities. You can create multiple
                company accounts.
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
