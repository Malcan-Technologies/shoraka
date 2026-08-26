"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Card, CardContent, Progress } from "@cashsouk/ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  OnboardingFeeConfirmingView,
  OnboardingFeeFailureView,
  OnboardingFeeUnderReviewView,
} from "@/components/onboarding-fee-return-views";
import { useExcessLateChargePaymentQuery } from "@/hooks/use-excess-late-charge-payment";
import { deriveExcessLateChargeReturnDialogView } from "@/lib/excess-late-charge-payment-ui";

const PAYMENT_CONFIRM_TIMEOUT_MS = 20_000;

export function ExcessLateChargeReturnDialog({
  noteId,
  paymentId,
  open,
  onDismiss,
  onPayNext,
  isPayingNext = false,
}: {
  noteId: string;
  paymentId: string;
  open: boolean;
  onDismiss: () => void;
  onPayNext: () => void;
  isPayingNext?: boolean;
}) {
  const [pollTimedOut, setPollTimedOut] = React.useState(false);
  const queryClient = useQueryClient();
  const paymentQuery = useExcessLateChargePaymentQuery(noteId, paymentId, {
    pollUntilTerminal: open,
  });
  const payment = paymentQuery.data;

  React.useEffect(() => {
    if (!open || payment?.status !== "COMPLETED") return;
    void queryClient.invalidateQueries({ queryKey: ["issuer-notes"] });
    void queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
  }, [open, payment?.status, queryClient]);

  const view = deriveExcessLateChargeReturnDialogView({
    paymentAmount: payment?.amount,
    paymentStatus: payment?.status,
    owedAmount: payment?.owedAmount ?? 0,
    paidAmount: payment?.paidAmount ?? 0,
    outstanding: payment?.outstanding ?? 0,
    noteReference: payment?.noteReference ?? "",
    perTxnMaxAmount: payment?.perTxnMaxAmount,
    isQueryError: paymentQuery.isError,
    pollTimedOut,
  });

  const shouldRunTimeout = open && view.awaitingConfirmation;

  React.useEffect(() => {
    if (!open || !shouldRunTimeout) {
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
        ? "Late charges paid"
        : view.phase === "partial"
          ? "Payment received"
          : view.phase === "under-review"
            ? "Payment under review"
            : "Payment not completed";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
    >
      <DialogContent
        className="max-w-md border-0 bg-transparent p-0 shadow-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
        {view.phase === "confirming" ? <OnboardingFeeConfirmingView onCancel={onDismiss} /> : null}
        {view.phase === "paid" ? (
          <PaidView
            totalPaid={view.totalPaid}
            thisPaymentAmount={view.thisPaymentAmount}
            showThisPaymentVsTotal={view.showThisPaymentVsTotal}
            onContinue={onDismiss}
          />
        ) : null}
        {view.phase === "partial" ? (
          <PartialView
            paidAmount={view.thisPaymentAmount ?? 0}
            creditedAmount={view.creditedAmount}
            owedAmount={view.owedAmount}
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

function PaidView({
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
          <h2 className="text-lg font-semibold">Late payment charges paid</h2>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(totalPaid)}
          </p>
          {showThisPaymentVsTotal && thisPaymentAmount != null ? (
            <p className="text-ui text-muted-foreground">
              This payment {formatCurrency(thisPaymentAmount)}. Total paid {formatCurrency(totalPaid)}.
            </p>
          ) : (
            <p className="text-ui text-muted-foreground">All outstanding late charges are paid.</p>
          )}
        </div>
        <Button type="button" variant="action" className="mt-8 h-11 w-full rounded-xl" onClick={onContinue}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function PartialView({
  paidAmount,
  creditedAmount,
  owedAmount,
  outstanding,
  progressPercent,
  onPayNext,
  onClose,
  isPayingNext,
}: {
  paidAmount: number;
  creditedAmount: number;
  owedAmount: number;
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
            {formatCurrency(creditedAmount)} of {formatCurrency(owedAmount)} is paid. Outstanding{" "}
            {formatCurrency(outstanding)}.
          </p>
        </div>
        <Progress value={progressPercent} aria-label="Late charges progress" />
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
