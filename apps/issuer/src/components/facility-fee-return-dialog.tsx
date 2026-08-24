"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Card, CardContent, Progress } from "@cashsouk/ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  OnboardingFeeConfirmingView,
  OnboardingFeeFailureView,
  OnboardingFeeUnderReviewView,
} from "@/components/onboarding-fee-return-views";
import { useFacilityFeePaymentQuery } from "@/hooks/use-facility-fee-payment";
import { deriveFacilityFeeReturnDialogView } from "@/lib/facility-fee-payment-ui";

const PAYMENT_CONFIRM_TIMEOUT_MS = 20_000;

interface FacilityFeeReturnDialogProps {
  contractId: string;
  paymentId: string;
  open: boolean;
  onDismiss: () => void;
  onPayNext: () => void;
  isPayingNext?: boolean;
}

export function FacilityFeeReturnDialog({
  contractId,
  paymentId,
  open,
  onDismiss,
  onPayNext,
  isPayingNext = false,
}: FacilityFeeReturnDialogProps) {
  const [pollTimedOut, setPollTimedOut] = React.useState(false);
  const queryClient = useQueryClient();

  const paymentQuery = useFacilityFeePaymentQuery(contractId, paymentId, {
    pollUntilTerminal: open,
  });
  const payment = paymentQuery.data;

  React.useEffect(() => {
    if (!open || payment?.status !== "COMPLETED") return;
    void queryClient.invalidateQueries({ queryKey: ["issuer-dashboard-contract"] });
    void queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["contracts"] });
    void queryClient.invalidateQueries({ queryKey: ["application"] });
  }, [open, payment?.status, queryClient]);

  const view = deriveFacilityFeeReturnDialogView({
    paymentAmount: payment?.amount,
    paymentStatus: payment?.status,
    upfrontAmount: payment?.upfrontAmount ?? 0,
    paidAmount: payment?.paidAmount ?? 0,
    outstanding: payment?.outstanding ?? 0,
    perTxnMaxAmount: payment?.perTxnMaxAmount,
    isQueryError: paymentQuery.isError,
    pollTimedOut,
  });

  const shouldRunTimeout = open && view.awaitingConfirmation;

  React.useEffect(() => {
    if (!open) {
      setPollTimedOut(false);
      return;
    }
    if (!shouldRunTimeout) {
      setPollTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setPollTimedOut(true), PAYMENT_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [open, paymentId, shouldRunTimeout]);

  const dialogTitle =
    view.phase === "confirming"
      ? "Confirming your payment"
      : view.phase === "paid"
        ? "Facility fee paid"
        : view.phase === "partial"
          ? "Payment received"
          : view.phase === "under-review"
            ? "Payment under review"
            : "Payment not completed";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onDismiss();
    }}>
      <DialogContent
        className="max-w-md border-0 bg-transparent p-0 shadow-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
        {view.phase === "confirming" ? (
          <OnboardingFeeConfirmingView onCancel={onDismiss} />
        ) : null}
        {view.phase === "paid" ? (
          <FacilityFeePaidView
            totalPaid={view.totalUpfrontPaid}
            thisPaymentAmount={view.thisPaymentAmount}
            showThisPaymentVsTotal={view.showThisPaymentVsTotal}
            onContinue={onDismiss}
          />
        ) : null}
        {view.phase === "partial" ? (
          <FacilityFeePartialView
            paidAmount={view.thisPaymentAmount ?? 0}
            creditedAmount={view.creditedAmount}
            upfrontAmount={view.upfrontAmount}
            outstanding={view.outstanding}
            progressPercent={view.progressPercent}
            onPayNext={onPayNext}
            onClose={onDismiss}
            isPayingNext={isPayingNext}
          />
        ) : null}
        {view.phase === "under-review" ? (
          <OnboardingFeeUnderReviewView onContinue={onDismiss} />
        ) : null}
        {view.phase === "failed" ? (
          <OnboardingFeeFailureView
            reason={view.failureReason}
            status={payment?.status}
            amount={payment?.amount}
            onTryAgain={onPayNext}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FacilityFeePaidView({
  totalPaid,
  thisPaymentAmount,
  showThisPaymentVsTotal,
  onContinue,
}: {
  totalPaid: number;
  thisPaymentAmount: number | null;
  showThisPaymentVsTotal: boolean;
  onContinue: () => void;
}) {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="px-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-success-bg">
          <CheckIcon className="h-8 w-8 text-status-success-text" strokeWidth={2.5} />
        </div>
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Upfront facility fee paid</h2>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(totalPaid)}
          </p>
          {showThisPaymentVsTotal && thisPaymentAmount != null ? (
            <p className="text-ui text-muted-foreground">
              This payment {formatCurrency(thisPaymentAmount)}. Total upfront paid{" "}
              {formatCurrency(totalPaid)}.
            </p>
          ) : (
            <p className="text-ui text-muted-foreground">Total upfront paid.</p>
          )}
          <p className="text-ui text-muted-foreground">
            Drawdowns are unlocked. You can finance invoices against this facility.
          </p>
        </div>
        <Button type="button" variant="action" className="mt-8 h-11 w-full rounded-xl" onClick={onContinue}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function FacilityFeePartialView({
  paidAmount,
  creditedAmount,
  upfrontAmount,
  outstanding,
  progressPercent,
  onPayNext,
  onClose,
  isPayingNext,
}: {
  paidAmount: number;
  creditedAmount: number;
  upfrontAmount: number;
  outstanding: number;
  progressPercent: number;
  onPayNext: () => void;
  onClose: () => void;
  isPayingNext: boolean;
}) {
  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <CardContent className="space-y-4 px-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-success-bg">
          <CheckIcon className="h-8 w-8 text-status-success-text" strokeWidth={2.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Payment received</h2>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(paidAmount)}
          </p>
          <p className="text-ui text-muted-foreground">
            {formatCurrency(creditedAmount)} of {formatCurrency(upfrontAmount)} is credited.
            Outstanding {formatCurrency(outstanding)}.
          </p>
        </div>
        <Progress value={progressPercent} aria-label="Upfront facility fee progress" />
        <Button
          type="button"
          variant="action"
          className="h-11 w-full rounded-xl"
          disabled={isPayingNext}
          aria-busy={isPayingNext}
          onClick={onPayNext}
        >
          {isPayingNext ? "Opening checkout..." : "Make next FPX payment"}
        </Button>
        <Button type="button" variant="ghost" className="h-10 w-full" onClick={onClose}>
          Pay later
        </Button>
      </CardContent>
    </Card>
  );
}
