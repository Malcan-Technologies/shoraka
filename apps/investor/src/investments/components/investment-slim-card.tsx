"use client";

import Link from "next/link";
import { InfoTooltip, NoteStatusBadge } from "@cashsouk/ui";
import {
  EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP,
  formatInvestorReturnRatePercent,
  resolveNoteTimingDisplay,
  type NoteListItem,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
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

export function InvestmentSlimCard({
  note,
  className,
}: {
  note: NoteListItem;
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

  return (
    <article
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5", className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <NoteStatusBadge note={note} viewer="investor" />
            <span className="text-ui font-semibold text-foreground">{facts.noteLabel}</span>
          </div>
          <InvestmentNoteIdentity note={note} />
          <p className="inline-flex flex-wrap items-center gap-1.5 text-ui leading-6 text-foreground">
            {investmentCardHeadline(note)}
            {returnDisplay.tooltip ? (
              <InfoTooltip content={returnDisplay.tooltip} iconClassName="h-3.5 w-3.5" />
            ) : facts.expectedReturnIsEstimate ? (
              <InfoTooltip content={EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP} iconClassName="h-3.5 w-3.5" />
            ) : null}
          </p>
          {meta ? <p className="text-ui leading-5 text-muted-foreground">{meta}</p> : null}
          {payoutResult ? <InvestmentPayoutResultLine result={payoutResult} /> : null}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[26rem] lg:w-[28rem]">
          <div className="grid grid-cols-3 items-stretch gap-3">
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
          <Button variant="outline" className="h-10 w-full rounded-xl" asChild>
            <Link href={`/investments/${note.id}`}>View details</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
