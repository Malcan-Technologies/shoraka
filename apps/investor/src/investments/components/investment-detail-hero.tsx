"use client";

import { formatCurrency } from "@cashsouk/config";
import { NoteStatusBadge } from "@cashsouk/ui";
import {
  formatInvestorReturnRatePercent,
  formatNoteInvestorCount,
  type NoteListItem,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import {
  formatInvestmentDate,
  getInvestmentMaturityDisplay,
  getInvestmentPositionFacts,
  investmentCardHeadline,
  investmentCardMeta,
  investmentCardPayoutResult,
  isInvestorInvestmentCompleted,
} from "../investment-position-model";
import {
  InvestmentKpiBox,
  InvestmentPayoutResultLine,
  MATURITY_VALUE_CLASS,
  formatRiskScore,
} from "./investment-card-metrics";

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
  const completed = isInvestorInvestmentCompleted(note);
  const useActualReturn = completed && facts.actualReturn != null;
  const profitRate = formatInvestorReturnRatePercent(
    useActualReturn ? facts.actualReturn : facts.expectedReturn
  );
  const profitLabel = useActualReturn ? "Actual" : "p.a.";

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
            <p className="text-ui leading-6 text-foreground">
              {facts.issuerName}
              {note.issuerIndustry?.trim() ? ` · ${note.issuerIndustry.trim()}` : ""}
            </p>
            {isInvestedView ? (
              <>
                <p className="text-ui leading-6 text-foreground">{investmentCardHeadline(note)}</p>
                {meta ? <p className="text-ui leading-5 text-muted-foreground">{meta}</p> : null}
                {payoutResult ? <InvestmentPayoutResultLine result={payoutResult} /> : null}
              </>
            ) : (
              <p className="text-ui leading-6 text-foreground">
                {formatCurrency(note.targetAmount)} target ·{" "}
                {formatInvestorReturnRatePercent(facts.expectedReturn)} p.a.
              </p>
            )}
          </div>

          <div className="grid w-full shrink-0 grid-cols-3 items-stretch gap-3 sm:w-[26rem] lg:w-[28rem]">
            <InvestmentKpiBox
              value={profitRate}
              label={profitLabel}
              valueClassName="text-foreground"
            />
            <InvestmentKpiBox value={riskScore} label="Score" valueClassName="text-foreground" />
            <InvestmentKpiBox
              value={maturity.value}
              label={maturity.unit ?? "Maturity"}
              extra={maturity.date || undefined}
              valueClassName={MATURITY_VALUE_CLASS[maturity.tone]}
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
