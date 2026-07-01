"use client";

import type { GatewayPaymentStatus } from "@cashsouk/types";
import {
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@cashsouk/ui";

function statusContent(status: GatewayPaymentStatus, amount: number) {
  switch (status) {
    case "COMPLETED":
      return {
        icon: CheckIcon,
        iconClassName: "bg-emerald-600",
        title: "Deposit successful",
        body: (
          <>
            <p className="text-muted-foreground">Your deposit of</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
            <p className="text-sm text-muted-foreground">
              has been credited to your available balance.
            </p>
          </>
        ),
      };
    case "REFUND_INITIATED":
    case "REFUNDED":
      return {
        icon: ClockIcon,
        iconClassName: "bg-slate-700",
        title: status === "REFUNDED" ? "Deposit refunded" : "Refund in progress",
        body: (
          <>
            <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
            <p className="text-sm text-muted-foreground">
              {status === "REFUNDED"
                ? "This deposit has been refunded to your bank account."
                : "Your deposit could not be verified and is being refunded automatically. This usually takes 5–7 working days."}
            </p>
          </>
        ),
      };
    case "HELD":
      return {
        icon: ExclamationTriangleIcon,
        iconClassName: "bg-amber-600",
        title: "Deposit could not be processed",
        body: (
          <>
            <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
            <p className="text-sm text-muted-foreground">
              We could not complete the automatic refund for this deposit. Our team has been
              notified and will follow up with you.
            </p>
          </>
        ),
      };
    case "NAME_CHECK_PENDING":
      return {
        icon: ClockIcon,
        iconClassName: "bg-slate-700",
        title: "Deposit received",
        body: (
          <>
            <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
            <p className="text-sm text-muted-foreground">
              Your payment was received and name verification is in progress. This usually
              completes within one business day.
            </p>
          </>
        ),
      };
    default:
      return {
        icon: ExclamationTriangleIcon,
        iconClassName: "bg-destructive",
        title: "Deposit could not be completed",
        body: (
          <>
            <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
            <p className="text-sm text-muted-foreground">
              This deposit did not complete. Please try again or contact support if the issue
              persists.
            </p>
          </>
        ),
      };
  }
}

interface DepositCompleteViewProps {
  amount: number;
  status: GatewayPaymentStatus;
  returnTo: string;
  onContinue?: () => void;
}

export function DepositCompleteView({
  amount,
  status,
  returnTo,
  onContinue,
}: DepositCompleteViewProps) {
  const content = statusContent(status, amount);
  const Icon = content.icon;

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-white shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${content.iconClassName}`}
        >
          <Icon className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>

        <div className="mt-6 space-y-2">
          <h1 className="text-lg font-semibold">{content.title}</h1>
          {content.body}
        </div>

        {onContinue ? (
          <Button
            type="button"
            variant="action"
            className="mt-8 h-11 w-full rounded-xl"
            onClick={onContinue}
          >
            Continue
          </Button>
        ) : (
          <Button asChild variant="action" className="mt-8 h-11 w-full rounded-xl">
            <Link href={returnTo}>Continue</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function DepositConfirmingView() {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-white shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        <h1 className="mt-6 text-lg font-semibold">Confirming your payment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This usually takes a few seconds after FPX completes.
        </p>
      </CardContent>
    </Card>
  );
}
