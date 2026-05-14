"use client";

import Link from "next/link";
import {
  ArrowDownTrayIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import {
  BuildingOffice2Icon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";
import { Button, cn } from "@cashsouk/ui";

export type PublicMarketplaceNote = {
  id: string;
  noteCode: string | null;
  title: string | null;
  industry: string | null;
  fundedAmount: number;
  goalAmount: number;
  annualReturn: number | null;
  tenorDays: number | null;
  riskScore: string | null;
  daysLeft: number | null;
  investable: boolean;
  isFeatured?: boolean;
  featuredRank?: number;
};

const MARKETPLACE_ACTION_BUTTON_CLASS =
  "bg-primary text-primary-foreground shadow-brand hover:opacity-95";

function currency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

function textOrDash(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

export function PublicMarketplaceNoteCard({ note }: { note: PublicMarketplaceNote }) {
  const progressDenominator = note.goalAmount > 0 ? note.goalAmount : 0;
  const fundingProgress =
    progressDenominator > 0
      ? Math.min(100, Math.round((note.fundedAmount / progressDenominator) * 100))
      : 0;

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm",
        note.isFeatured && "border-border bg-card"
      )}
    >
      <div className="p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {textOrDash(note.title)}
              </h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <BuildingOffice2Icon className="h-3.5 w-3.5 text-primary" />
                  {textOrDash(note.industry)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5 text-primary" />
                  Note: {textOrDash(note.noteCode)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
              aria-label="More note actions"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">
                {note.daysLeft !== null ? `${note.daysLeft} day(s) left` : "-"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${fundingProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-foreground">
              <span>Funded {currency(note.fundedAmount)}</span>
              <span>Goal {currency(note.goalAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="px-3 py-4 text-center">
              <div className="text-4xl font-semibold leading-none text-foreground">
                {note.annualReturn !== null ? `${note.annualReturn}%` : "-"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Per annum</div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-4xl font-semibold leading-none text-foreground">
                {note.tenorDays ?? "-"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Days</div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-4xl font-semibold leading-none text-foreground">
                {textOrDash(note.riskScore)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Score</div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              asChild={note.investable}
              variant="default"
              className={cn("h-10 w-full rounded-lg text-sm", MARKETPLACE_ACTION_BUTTON_CLASS)}
              disabled={!note.investable}
            >
              {note.investable ? (
                <Link href="/get-started">Invest now</Link>
              ) : (
                <span>Fully allocated</span>
              )}
            </Button>
            <Button
              variant="ghost"
              className="h-7 w-full gap-1 text-xs text-muted-foreground hover:bg-transparent hover:text-primary"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              Download info sheet
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
