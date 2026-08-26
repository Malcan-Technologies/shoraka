"use client";

import { formatCurrency } from "@cashsouk/config";
import { InfoTooltip, NoteStatusBadge } from "@cashsouk/ui";
import {
  EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP,
  formatInvestorReturnRatePercent,
  formatNoteInvestorCount,
  resolveNoteTimingDisplay,
  type NoteListItem,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import {
  formatInvestmentDate,
  getInvestmentMaturityDisplay,
  getInvestmentPositionFacts,
  getInvestmentReturnDisplay,
  investmentCardHeadline,
  investmentCardMeta,
  investmentCardPayoutResult,
} from "../investment-position-model";
import {
  InvestmentKpiBox,
  InvestmentPayoutResultLine,
  formatRiskScore,
  investmentDateKpiValueClassName,
} from "./investment-card-metrics";
import { InvestmentNoteIdentity } from "./investment-note-identity";

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
      <p className="text-ui text-muted-foreground">{label}</p>
      <p className="mt-1 text-ui font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function InvestmentDetailHero({
  note,
  investmentDate,
  isInvestedView,
  className,
}: {
  note: NoteListItem;
  investmentDate?: string | null;
  isInvestedView: boolean;
  className?: string;
}) {
  const facts = getInvestmentPositionFacts(note);
  const meta = investmentCardMeta(note);
  const payoutResult = investmentCardPayoutResult(note);
  const maturity = getInvestmentMaturityDisplay(note);
  const riskScore = formatRiskScore(note.riskRating);
  const returnDisplay = getInvestmentReturnDisplay(note);
  const profitRate = formatInvestorReturnRatePercent(returnDisplay.ratePercent);
  const profitLabel = returnDisplay.label;
  const timing = resolveNoteTimingDisplay(note);

  const factTiles = isInvestedView
    ? [
        { label: "Invested", value: formatCurrency(facts.invested) },
        {
          label: "Received",
          value: facts.received > 0.005 ? formatCurrency(facts.received) : "—",
        },
        { label: "Investment date", value: formatInvestmentDate(investmentDate) },
        { label: "Investors", value: formatNoteInvestorCount(note.investorCount ?? 0) },
      ]
    : [
        { label: "Target", value: formatCurrency(note.targetAmount) },
        { label: "Funded", value: formatCurrency(note.fundedAmount) },
        { label: "Investors", value: formatNoteInvestorCount(note.investorCount ?? 0) },
        { label: "Paymaster", value: note.paymasterName?.trim() || "—" },
      ];

  return (
    <div className={cn("space-y-4", className)}>
      <article className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <NoteStatusBadge note={note} viewer="investor" />
              <span className="text-ui font-semibold text-foreground">{facts.noteLabel}</span>
            </div>
            <InvestmentNoteIdentity note={note} />
            {isInvestedView ? (
              <>
                <p className="inline-flex flex-wrap items-center gap-1.5 text-ui leading-6 text-foreground">
                  {investmentCardHeadline(note)}
                  {returnDisplay.tooltip ? (
                    <InfoTooltip content={returnDisplay.tooltip} iconClassName="h-3.5 w-3.5" />
                  ) : facts.expectedReturnIsEstimate ? (
                    <InfoTooltip
                      content={EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP}
                      iconClassName="h-3.5 w-3.5"
                    />
                  ) : null}
                </p>
                {meta ? <p className="text-ui leading-5 text-muted-foreground">{meta}</p> : null}
                {payoutResult ? <InvestmentPayoutResultLine result={payoutResult} /> : null}
              </>
            ) : (
              <p className="text-ui leading-6 text-foreground">
                {formatCurrency(note.targetAmount)} target ·{" "}
                {facts.expectedReturnIsEstimate ? "Up to " : ""}
                {formatInvestorReturnRatePercent(facts.expectedReturn)}
                {facts.expectedReturnIsEstimate ? "" : " p.a."}
              </p>
            )}
          </div>

          <div className="grid w-full shrink-0 grid-cols-3 items-stretch gap-3 sm:w-[26rem] lg:w-[28rem]">
            <InvestmentKpiBox
              value={profitRate}
              label={profitLabel}
              tooltip={returnDisplay.tooltip}
              valueClassName="text-foreground"
            />
            <InvestmentKpiBox value={riskScore} label="Score" valueClassName="text-foreground" />
            <InvestmentKpiBox
              value={maturity.value}
              label={maturity.unit ?? "Maturity"}
              tooltip={maturity.tooltip ?? timing.tooltip}
              valueClassName={investmentDateKpiValueClassName(maturity.value, maturity.tone)}
            />
          </div>
        </div>
      </article>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {factTiles.map((tile) => (
          <FactTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>
    </div>
  );
}
