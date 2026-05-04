"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { useHeader, Card, CardContent, CardHeader, CardTitle, Badge, Progress } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useIssuerNote,
  useIssuerNotePaymentInstructions,
  useSubmitIssuerPayment,
} from "@/notes/hooks/use-issuer-notes";
import { LedgerPanel } from "@/notes/components/ledger-panel";
import { isSoukscoreRiskRating, type NoteDetail, type NoteSettlementPoolSummary } from "@cashsouk/types";

function getSettlementAmount(note: NoteDetail) {
  const extended = note as NoteDetail & { settlementAmount?: number; invoiceAmount?: number };
  return extended.settlementAmount ?? extended.invoiceAmount ?? note.requestedAmount;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getRiskRating(note: NoteDetail) {
  const offerDetails = asRecord(note.invoiceSnapshot?.offer_details);
  const riskRating = offerDetails?.risk_rating;
  return isSoukscoreRiskRating(riskRating) ? riskRating : "—";
}

function getFundingProgressClass(fundingStatus: NoteDetail["fundingStatus"]) {
  if (fundingStatus === "FUNDED" || fundingStatus === "FAILED") {
    return "bg-muted [&>div]:bg-black";
  }
  return "[&>div]:bg-primary";
}

function formatMaturityDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-MY") : "Not set";
}

function formatMaturityTiming(value: string | null) {
  if (!value) return "No maturity date set";
  const maturityDate = new Date(value);
  const today = new Date();
  const maturityStart = new Date(
    maturityDate.getFullYear(),
    maturityDate.getMonth(),
    maturityDate.getDate()
  );
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((maturityStart.getTime() - todayStart.getTime()) / 86_400_000);
  const absoluteDays = Math.abs(days);
  const dayLabel = `${absoluteDays} day${absoluteDays === 1 ? "" : "s"}`;

  if (days === 0) return "Due today";
  return days > 0 ? `${dayLabel} remaining` : `${dayLabel} overdue`;
}

function getLateFeeSummary(note: NoteDetail) {
  const lateFeeSettlements = note.settlements.filter((settlement) => settlement.status !== "VOID");
  const assessedTawidhAmount = lateFeeSettlements.reduce(
    (sum, settlement) => sum + settlement.tawidhAmount,
    0
  );
  const assessedGharamahAmount = lateFeeSettlements.reduce(
    (sum, settlement) => sum + settlement.gharamahAmount,
    0
  );
  const assessedAmount = assessedTawidhAmount + assessedGharamahAmount;

  return {
    assessedAmount,
    assessedTawidhAmount,
    assessedGharamahAmount,
  };
}

function getSettlementSummary(note: NoteDetail): NoteSettlementPoolSummary | null {
  if (note.settlementSummary) return note.settlementSummary;
  const settlement = note.settlements.find((item) => item.status === "POSTED") ?? null;
  if (!settlement) return null;
  return {
    settlementId: settlement.id,
    status: settlement.status,
    grossReceiptAmount: settlement.grossReceiptAmount,
    investorPoolAmount: settlement.investorPrincipal + settlement.investorProfitNet,
    operatingAccountAmount: settlement.serviceFeeAmount,
    tawidhAccountAmount: settlement.tawidhAmount,
    gharamahAccountAmount: settlement.gharamahAmount,
    issuerResidualAmount: settlement.issuerResidualAmount,
    unappliedAmount: settlement.unappliedAmount,
    postedAt: settlement.postedAt,
  };
}

function BucketPayoutCard({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{formatCurrency(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

export default function IssuerNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { setTitle } = useHeader();
  const { data: note, isLoading, error } = useIssuerNote(noteId);
  const { data: instructions } = useIssuerNotePaymentInstructions(noteId);
  const submitPayment = useSubmitIssuerPayment(noteId);
  const [reference, setReference] = React.useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = React.useState(false);

  React.useEffect(() => {
    setTitle("Note Detail");
  }, [setTitle]);

  const openPaymentDialog = () => {
    setPaymentConfirmed(false);
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!note) return;
    const settlementSummary = getSettlementSummary(note);
    if (note.servicingStatus === "SETTLED" || settlementSummary?.status === "POSTED") {
      toast.info("This note has already been settled");
      return;
    }
    if (note.fundingStatus !== "FUNDED" || note.servicingStatus === "NOT_STARTED") {
      toast.info("Settlement payment opens after funding is complete and admin activates servicing");
      return;
    }
    const receiptAmount = getSettlementAmount(note);

    if (receiptAmount <= 0) {
      toast.error("This note does not have an invoice settlement amount yet");
      return;
    }
    try {
      await submitPayment.mutateAsync({
        receiptAmount,
        receiptDate: new Date().toISOString(),
        reference: reference || null,
        metadata: { paymentPurpose: "SETTLEMENT" },
      });
      setReference("");
      setPaymentConfirmed(false);
      setPaymentDialogOpen(false);
      toast.success("Payment confirmation submitted for admin reconciliation");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit payment");
    }
  };

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading note...</div>;
  if (error || !note) {
    return <div className="p-4 text-destructive">{error instanceof Error ? error.message : "Note not found"}</div>;
  }
  const settlementAmount = getSettlementAmount(note);
  const fundingRatio = note.targetAmount > 0 ? (note.fundedAmount / note.targetAmount) * 100 : 0;
  const fundingProgress = Math.min(Math.max(fundingRatio, 0), 100);
  const progressClassName = getFundingProgressClass(note.fundingStatus);
  const instructionEntries = Object.entries(instructions ?? {});
  const lateFeeSummary = getLateFeeSummary(note);
  const maturityDateLabel = formatMaturityDate(note.maturityDate);
  const maturityTimingLabel = formatMaturityTiming(note.maturityDate);
  const settlementSummary = getSettlementSummary(note);
  const riskRating = getRiskRating(note);
  const isSettled = note.servicingStatus === "SETTLED" || settlementSummary?.status === "POSTED";
  const paymentBlockedReason = isSettled
    ? "This note has been settled. Payment is closed and no further issuer payment confirmation is needed."
    : note.fundingStatus !== "FUNDED"
      ? "Payment is not available while the note is still published or funding. It opens only after funding is complete."
      : note.servicingStatus === "NOT_STARTED"
        ? "Payment opens after admin activates the funded note for servicing."
        : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 pt-4">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-2 md:p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <DocumentTextIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Note Detail
              </div>
              <h1 className="truncate text-2xl font-semibold">{note.title}</h1>
              <p className="mt-1 text-muted-foreground">{note.noteReference}</p>
            </div>
          </div>
          <Badge variant="outline">{note.servicingStatus.replace(/_/g, " ")}</Badge>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <div className="text-xs text-muted-foreground">Invoice Amount</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(settlementAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Target Amount</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(note.targetAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Funded Amount</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(note.fundedAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Funding Ratio</div>
                <div className="mt-1 text-xl font-semibold">{fundingRatio.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risk Rating</div>
                <div className="mt-1 text-xl font-semibold">{riskRating}</div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Funding progress</span>
                <span>{fundingRatio.toFixed(1)}%</span>
              </div>
              <Progress value={fundingProgress} className={`h-3 ${progressClassName}`} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{note.fundingStatus.replace(/_/g, " ")}</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settlement Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-primary/5 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  <div className="text-sm text-muted-foreground">Amount to pay</div>
                  <div className="mt-1 text-3xl font-semibold text-primary">
                    {formatCurrency(settlementAmount)}
                  </div>
                </div>
                <div className="rounded-xl border bg-background/80 px-4 py-3 md:min-w-48">
                  <div className="text-xs text-muted-foreground">Maturity</div>
                  <div className="mt-1 font-semibold">{maturityDateLabel}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{maturityTimingLabel}</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This is the invoice settlement amount payable into the Repayment Pool. It is different from the funded or disbursed amount when the note is not fully funded.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Open the payment instructions, pay this exact amount into the repayment pool on behalf of the paymaster,
              then submit the payment reference for admin reconciliation.
            </p>
            {paymentBlockedReason ? (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  isSettled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-amber-200 bg-amber-50 text-amber-950"
                }`}
              >
                {paymentBlockedReason}
              </div>
            ) : null}
            <Button onClick={openPaymentDialog} disabled={settlementAmount <= 0 || paymentBlockedReason != null}>
              {isSettled ? "Payment Settled" : "Make Payment"}
            </Button>
          </CardContent>
        </Card>

        {settlementSummary ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Settlement Payout Summary</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Posted settlement allocation across the platform buckets.
                  </p>
                </div>
                <Badge variant="secondary">Settled</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <BucketPayoutCard
                  label="Repayment Pool"
                  value={settlementSummary.grossReceiptAmount}
                  description="Gross receipt paid into the repayment pool."
                />
                <BucketPayoutCard
                  label="Investor Pool"
                  value={settlementSummary.investorPoolAmount}
                  description="Principal and net profit paid out to investors."
                />
                <BucketPayoutCard
                  label="Operating Account"
                  value={settlementSummary.operatingAccountAmount}
                  description="Service fee retained by the platform."
                />
                <BucketPayoutCard
                  label="Ta'widh Account"
                  value={settlementSummary.tawidhAccountAmount}
                  description="Approved compensation late-fee allocation."
                />
                <BucketPayoutCard
                  label="Gharamah Account"
                  value={settlementSummary.gharamahAccountAmount}
                  description="Approved charity/penalty late-fee allocation."
                />
              </div>
              <div className="rounded-xl border border-dashed p-4 text-sm">
                <span className="font-medium">Issuer residual:</span>{" "}
                {formatCurrency(settlementSummary.issuerResidualAmount)} is the residual refund after investor
                allocation, service fee, and late-fee accounts.
              </div>
            </CardContent>
          </Card>
        ) : null}

        {lateFeeSummary.assessedAmount > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Late Fee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-amber-50 p-5 text-amber-950">
                <div className="text-sm text-amber-800">Assessed late fees</div>
                <div className="mt-1 text-3xl font-semibold">
                  {formatCurrency(lateFeeSummary.assessedAmount)}
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-amber-800">{"Ta'widh"}</div>
                    <div className="font-semibold">{formatCurrency(lateFeeSummary.assessedTawidhAmount)}</div>
                  </div>
                  <div>
                    <div className="text-amber-800">Gharamah</div>
                    <div className="font-semibold">{formatCurrency(lateFeeSummary.assessedGharamahAmount)}</div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Late fees are borne by the issuer, but the issuer does not make a separate late-fee payment here.
                Admin deducts approved {"Ta'widh"} and Gharamah from the repayment pool before returning any residual
                balance to the issuer.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <LedgerPanel note={note} />
      </div>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            setPaymentConfirmed(false);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Settlement Payment</DialogTitle>
            <DialogDescription className="text-[15px] leading-7">
              Use the instructions below to pay the invoice settlement amount into the Repayment Pool.
              Submit this confirmation only after the payment has been made.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-2xl border bg-primary/5 p-5">
              <div className="text-sm text-muted-foreground">Settlement amount to pay</div>
              <div className="mt-1 text-3xl font-semibold text-primary">{formatCurrency(settlementAmount)}</div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="mb-3 font-semibold">Repayment Instructions</div>
              {instructionEntries.length ? (
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  {instructionEntries.map(([key, value]) => (
                    <div key={key}>
                      <div className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</div>
                      <div className="font-medium">{String(value)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Repayment instructions are not available yet. Contact support before making payment.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="payment-reference">
                Payment reference
              </label>
              <Input
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Bank transfer reference or receipt number"
              />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
              <Checkbox
                checked={paymentConfirmed}
                onCheckedChange={(checked) => setPaymentConfirmed(checked === true)}
                className="mt-1"
              />
              <span>
                I confirm that I have made this payment to the repayment account shown above and understand that
                admin will reconcile the receipt before settlement is posted.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setPaymentDialogOpen(false);
                setPaymentConfirmed(false);
              }}
              disabled={submitPayment.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleSubmitPayment}
              disabled={!paymentConfirmed || submitPayment.isPending || settlementAmount <= 0 || paymentBlockedReason != null}
            >
              {submitPayment.isPending ? "Submitting..." : "Submit Payment Confirmation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

