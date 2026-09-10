"use client";

import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { Button } from "@/components/ui/button";

export function InvestorDashboardNew({
  availableBalance,
  openNoteCount,
  seekingFunding,
  tenorLabel,
  minCommitMyr,
  onDeposit,
}: {
  availableBalance: number | null;
  openNoteCount: number | null;
  seekingFunding: number | null;
  tenorLabel: string;
  minCommitMyr: number;
  onDeposit: () => void;
}) {
  const cards = [
    availableBalance != null
      ? {
          key: "balance",
          label: "Available balance",
          value: formatCurrency(availableBalance),
          hint: availableBalance > 0 ? "Ready to invest" : "Deposit to begin",
        }
      : null,
    openNoteCount != null
      ? {
          key: "open",
          label: "Notes open now",
          value: String(openNoteCount),
          hint:
            seekingFunding != null
              ? `${formatCurrency(seekingFunding)} seeking funding`
              : "Open on the marketplace",
        }
      : null,
    {
      key: "tenor",
      label: "Typical tenor",
      value: tenorLabel,
      hint: "Set per note at issue",
    },
    {
      key: "min",
      label: "Minimum per note",
      value: formatCurrency(minCommitMyr),
      hint: "No cap on participation",
    },
  ].filter((card): card is NonNullable<typeof card> => card != null);

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
        <CardContent className="p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-[15rem]">
              <StatusBadge label="Account approved" status="success" size="sm" showDot />
              <h2 className="mt-2.5 text-section-title text-primary">
                Fund your wallet to start investing
              </h2>
              <p className="mt-2 max-w-[60ch] text-body leading-7 text-muted-foreground">
                Your wallet is live
                {availableBalance === 0 ? " and empty" : ""}. Deposit by FPX or bank transfer, then
                commit to any note on the marketplace from {formatCurrency(minCommitMyr)}.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="h-11 rounded-xl font-semibold" onClick={onDeposit}>
                <PlusIcon className="h-4 w-4" />
                Deposit funds
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl font-medium">
                <Link href="/marketplace">Browse marketplace</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            <HowStep n={1} filled title="Deposit">
              Money lands in your Investor Pool balance, usually within minutes.
            </HowStep>
            <HowStep n={2} title="Pick notes">
              Each note is one issuer invoice with a fixed tenor and expected return.
            </HowStep>
            <HowStep n={3} title="Get repaid">
              Principal and profit return to your wallet at settlement. Reinvest or withdraw.
            </HowStep>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key} className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <p className="text-ui font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {card.value}
                {card.key === "tenor" ? (
                  <span className="text-body font-medium text-muted-foreground"> days</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-meta text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function HowStep({
  n,
  title,
  filled,
  children,
}: {
  n: number;
  title: string;
  filled?: boolean;
  children: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={
          filled
            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-ui font-semibold text-primary-foreground"
            : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-ui font-semibold text-primary"
        }
      >
        {n}
      </span>
      <div>
        <p className="text-ui font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-ui leading-6 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
