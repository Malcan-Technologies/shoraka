"use client";

import { formatCurrency } from "@cashsouk/config";
import { formatInvestorReturnRatePercent, isNoteMoneyAmount } from "@cashsouk/types";
import { MoneyInput } from "@cashsouk/ui";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  InvestorActionDialog,
  InvestorActionDialogIcon,
} from "@/components/investor-action-dialog";
import { formatRiskScore } from "@/investments/components/investment-card-metrics";
import { MarketplaceFailedFundingTooltip } from "./marketplace-failed-funding-tooltip";
import { MarketplaceIndustryIcon } from "./marketplace-industry-icon";
import {
  marketplaceAvailableCashHint,
  marketplaceConfirmLead,
  marketplaceInvestLead,
  marketplaceInvestMeta,
  marketplaceInvestRangeHint,
} from "./marketplace-invest-copy";
import {
  marketplaceIssuerLabel,
  marketplaceNoteLabel,
  type MarketplaceNote,
} from "./marketplace-note-model";

function InvestFact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-2 py-3 text-center">
      <p className="text-card-title tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-meta text-muted-foreground">{label}</p>
    </div>
  );
}

export function MarketplaceInvestDialog({
  note,
  amount,
  availableBalance,
  agreedToTerms,
  validationError,
  isConfirming,
  isPending,
  canConfirm,
  onAmountChange,
  onAgreedToTermsChange,
  onCancel,
  onInvest,
  onConfirm,
  onBackFromConfirm,
  onViewProspectus,
}: {
  note: MarketplaceNote | null;
  amount: string;
  availableBalance: number;
  agreedToTerms: boolean;
  validationError: string | null;
  isConfirming: boolean;
  isPending: boolean;
  canConfirm: boolean;
  onAmountChange: (value: string) => void;
  onAgreedToTermsChange: (value: boolean) => void;
  onCancel: () => void;
  onInvest: () => void;
  onConfirm: () => void;
  onBackFromConfirm: () => void;
  onViewProspectus: (note: MarketplaceNote) => void;
}) {
  const parsedAmount = Number(amount.replaceAll(",", "").replaceAll(" ", ""));
  const amountLabel = isNoteMoneyAmount(parsedAmount) ? formatCurrency(parsedAmount) : amount;
  const rangeHint = marketplaceInvestRangeHint(note);

  return (
    <InvestorActionDialog
      open={Boolean(note)}
      onOpenChange={(open) => !open && onCancel()}
      contentClassName="sm:max-w-lg"
      icon={
        <InvestorActionDialogIcon>
          <BanknotesIcon className="size-6" />
        </InvestorActionDialogIcon>
      }
      title={isConfirming ? "Ready to invest?" : "Invest"}
      description={
        isConfirming ? marketplaceConfirmLead(amountLabel, note) : marketplaceInvestLead(note)
      }
      footer={
        isConfirming ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              onClick={onBackFromConfirm}
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="action"
              className="h-11 flex-1 rounded-xl"
              onClick={onConfirm}
              disabled={isPending || !canConfirm}
            >
              {isPending ? "Confirming…" : "Confirm investment"}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="action"
              className="h-11 flex-1 rounded-xl"
              onClick={onInvest}
              disabled={!agreedToTerms || !note?.investable}
            >
              Review investment
            </Button>
          </>
        )
      }
      footnote={
        isConfirming
          ? "Once confirmed, we reserve this amount from your available cash."
          : note && rangeHint
            ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                {rangeHint}
                <MarketplaceFailedFundingTooltip minimumPercent={note.minimumFundingPercent} />
              </span>
            )
            : null
      }
    >
      {isConfirming ? (
        <div className="rounded-2xl border border-border bg-muted/40 px-5 py-6 text-center">
          <p className="text-ui text-muted-foreground">Investment amount</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {amountLabel}
          </p>
          {note ? (
            <p className="mt-2 text-ui text-muted-foreground">{marketplaceNoteLabel(note)}</p>
          ) : null}
        </div>
      ) : (
        <>
          {note ? (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
              <MarketplaceIndustryIcon industry={note.industry} />
              <div className="min-w-0 space-y-1">
                <p className="text-ui font-semibold text-foreground">{marketplaceIssuerLabel(note)}</p>
                <p className="text-ui text-foreground">{marketplaceInvestMeta(note)}</p>
                {note.industry?.trim() ? (
                  <p className="text-ui text-muted-foreground">{note.industry.trim()}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {note ? (
            <div className="grid grid-cols-3 gap-2">
              <InvestFact
                value={formatInvestorReturnRatePercent(note.annualReturn)}
                label="p.a."
              />
              <InvestFact value={formatRiskScore(note.riskScore)} label="Score" />
              <InvestFact
                value={note.tenorDays != null ? String(note.tenorDays) : "—"}
                label="Days"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5 text-ui text-foreground">
              How much would you like to invest?
              {note ? (
                <MarketplaceFailedFundingTooltip minimumPercent={note.minimumFundingPercent} />
              ) : null}
            </Label>
            <MoneyInput
              value={amount}
              onValueChange={(next) => onAmountChange(next)}
              prefix="RM"
              placeholder="0.00"
              inputClassName="h-11 rounded-xl border-input text-foreground focus-visible:ring-ring"
            />
            {validationError ? (
              <p className="text-ui text-destructive">{validationError}</p>
            ) : (
              <p className="text-meta text-muted-foreground">
                {marketplaceAvailableCashHint(availableBalance)}
              </p>
            )}
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="marketplace-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => onAgreedToTermsChange(Boolean(checked))}
              className="mt-0.5"
            />
            <Label htmlFor="marketplace-terms" className="text-ui font-normal leading-6 text-muted-foreground">
              I've read the{" "}
              <button
                type="button"
                className="text-foreground underline-offset-2 hover:underline"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!note) return;
                  onViewProspectus(note);
                }}
              >
                prospectus
              </button>{" "}
              and I'm ready to continue.
            </Label>
          </div>
        </>
      )}
    </InvestorActionDialog>
  );
}
