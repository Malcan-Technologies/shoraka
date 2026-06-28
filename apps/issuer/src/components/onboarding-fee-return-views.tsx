"use client";

import type { GatewayPaymentStatus } from "@cashsouk/types";
import {
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@cashsouk/ui";

function StatusIcon({
  icon: Icon,
  className,
}: {
  icon: typeof CheckIcon;
  className: string;
}) {
  return (
    <div
      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${className}`}
    >
      <Icon className="h-8 w-8 text-white" strokeWidth={2.5} />
    </div>
  );
}

export function OnboardingFeeConfirmingView({
  onCancel,
}: {
  onCancel?: () => void;
}) {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h2 className="mt-6 text-lg font-semibold">Confirming your payment</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re checking with your bank. This usually takes a few seconds.
        </p>
        {onCancel ? (
          <Button type="button" variant="ghost" className="mt-6" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OnboardingFeeStartingEkycView() {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h2 className="mt-6 text-lg font-semibold">Starting verification</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment was received. Opening company verification (eKYB)…
        </p>
      </CardContent>
    </Card>
  );
}

export function ApplicationSubmittingView() {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h2 className="mt-6 text-lg font-semibold">Submitting your application</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment was received. We&apos;re submitting your application for review.
        </p>
      </CardContent>
    </Card>
  );
}

export function ApplicationSubmittedSuccessView({ onContinue }: { onContinue?: () => void }) {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <StatusIcon icon={CheckIcon} className="bg-emerald-600" />
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Application submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your application has been sent for review. You can track its status from your
            applications list.
          </p>
        </div>
        {onContinue ? (
          <Button type="button" variant="action" className="mt-8 h-11 w-full rounded-xl" onClick={onContinue}>
            View applications
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OnboardingFeeSuccessView({ amount }: { amount: number }) {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <StatusIcon icon={CheckIcon} className="bg-emerald-600" />
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Payment successful</h2>
          <p className="text-muted-foreground">Your onboarding fee of</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
          <p className="text-sm text-muted-foreground">has been received.</p>
        </div>
      </CardContent>
    </Card>
  );
}

type FailureReason = "failed" | "timeout" | "error";

function failureCopy(reason: FailureReason, status?: GatewayPaymentStatus) {
  if (reason === "timeout") {
    return {
      title: "Still waiting on confirmation",
      description:
        "We haven't received a confirmation from your bank yet. You can wait a little longer or try the payment again.",
    };
  }

  if (reason === "error") {
    return {
      title: "Couldn't check payment status",
      description: "Something went wrong while checking your payment. Please try again.",
    };
  }

  if (status === "EXPIRED") {
    return {
      title: "Payment expired",
      description: "This payment session has expired. Please start a new payment to continue.",
    };
  }

  return {
    title: "Payment not completed",
    description:
      "Your FPX payment wasn't completed. No fee has been charged — you can try again when ready.",
  };
}

export function OnboardingFeeFailureView({
  reason,
  status,
  amount,
  onTryAgain,
  title,
  description,
}: {
  reason: FailureReason;
  status?: GatewayPaymentStatus;
  amount?: number;
  onTryAgain: () => void;
  title?: string;
  description?: string;
}) {
  const copy = title && description ? { title, description } : failureCopy(reason, status);

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <StatusIcon icon={ExclamationTriangleIcon} className="bg-destructive" />
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">{copy.title}</h2>
          {amount != null ? (
            <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <Button
          type="button"
          variant="action"
          className="mt-8 h-11 w-full rounded-xl gap-2"
          onClick={onTryAgain}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
