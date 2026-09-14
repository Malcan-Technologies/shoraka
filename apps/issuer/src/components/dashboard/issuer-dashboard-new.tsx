"use client";

import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import {
  FINANCING_TENURE_MAX_DAYS,
  FINANCING_TENURE_MIN_DAYS,
} from "@cashsouk/types";
import { ApplyForFinancingButton } from "@/components/apply-for-financing-button";
import { hasFacilityLimit } from "./issuer-dashboard-display";

export function IssuerDashboardNew({
  availableLimit,
  approvedLimit,
}: {
  availableLimit: number | null;
  approvedLimit: number | null;
}) {
  const liveLimit = hasFacilityLimit({ availableLimit, approvedLimit });
  const limitValue = availableLimit ?? approvedLimit ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 to-card shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-[15rem]">
              <StatusBadge label="Approved to apply" status="success" size="sm" />
              <h2 className="mt-2.5 text-section-title text-primary">Turn an unpaid invoice into cash</h2>
              <p className="mt-2 max-w-[60ch] text-pretty text-ui leading-6 text-muted-foreground">
                You are cleared to apply. Bring one invoice from a creditworthy paymaster and we will
                price a facility against it.
              </p>
            </div>
            <ApplyForFinancingButton className="h-11 shrink-0 rounded-xl font-semibold">
              Start an application
            </ApplyForFinancingButton>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <HowStep
              n={1}
              filled
              title="Apply"
              body="Upload the invoice, name the paymaster, choose the tenor."
            />
            <HowStep n={2} title="Accept an offer" body="We price it and send terms. You accept or request changes." />
            <HowStep
              n={3}
              title="Get funded"
              body="Investors fund the note, the trustee disburses to your account."
            />
            <HowStep
              n={4}
              title="Repay at maturity"
              body="Your paymaster settles the invoice and the note closes."
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Outstanding financing" value={formatCurrency(0, { decimals: 0 })} hint="No live notes yet" />
        {liveLimit ? (
          <StatCard
            title="Available limit"
            value={formatCurrency(limitValue, { decimals: 0 })}
            hint="Confirmed on your facility"
          />
        ) : null}
        <StatCard
          title="Typical tenor"
          value={`${FINANCING_TENURE_MIN_DAYS}–${FINANCING_TENURE_MAX_DAYS}`}
          unit="days"
          hint="Matched to your invoice due date"
        />
      </div>
    </div>
  );
}

function HowStep({
  n,
  title,
  body,
  filled,
}: {
  n: number;
  title: string;
  body: string;
  filled?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={
          filled
            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-meta font-semibold text-primary-foreground"
            : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-meta font-semibold text-primary"
        }
      >
        {n}
      </span>
      <div>
        <p className="text-ui font-medium">{title}</p>
        <p className="mt-0.5 text-ui leading-6 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  unit,
}: {
  title: string;
  value: string;
  hint: string;
  unit?: string;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <p className="text-ui font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
          {value}
          {unit ? <span className="text-ui font-medium text-muted-foreground"> {unit}</span> : null}
        </p>
        <p className="mt-0.5 text-meta text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
