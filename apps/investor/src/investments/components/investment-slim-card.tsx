"use client";

import Link from "next/link";
import { NoteStatusBadge } from "@cashsouk/ui";
import { formatInvestorReturnRatePercent, type NoteListItem } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
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
  const completed = isInvestorInvestmentCompleted(note);
  const useActualReturn = completed && facts.actualReturn != null;
  const profitRate = formatInvestorReturnRatePercent(
    useActualReturn ? facts.actualReturn : facts.expectedReturn
  );
  const profitLabel = useActualReturn ? "Actual" : "p.a.";

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
          <p className="text-ui leading-6 text-foreground">{investmentCardHeadline(note)}</p>
          {meta ? <p className="text-ui leading-5 text-muted-foreground">{meta}</p> : null}
          {payoutResult ? <InvestmentPayoutResultLine result={payoutResult} /> : null}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[26rem] lg:w-[28rem]">
          <div className="grid grid-cols-3 items-stretch gap-3">
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
          <Button variant="outline" className="h-10 w-full rounded-xl" asChild>
            <Link href={`/investments/${note.id}`}>View details</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
