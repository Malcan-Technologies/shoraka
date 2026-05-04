"use client";

import { ArrowDownTrayIcon, BuildingOffice2Icon, DocumentTextIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MARKETPLACE_ACTION_BUTTON_CLASS =
  "bg-slate-950 text-white hover:bg-slate-900";

export type MarketplaceNote = {
  id: string;
  noteCode: string;
  title: string;
  industry: string;
  fundedAmount: number;
  goalAmount: number;
  annualReturn: number;
  tenorDays: number;
  riskScore: string;
  daysLeft: number;
  minInvestment: number;
  maxInvestment: number;
  /** When false, capacity rules mean no valid commit (e.g. fully allocated). */
  investable: boolean;
  isFeatured?: boolean;
  featuredRank?: number;
};

type NoteCardProps = {
  note: MarketplaceNote;
  onInvest: (note: MarketplaceNote) => void;
};

function currency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

export function NoteCard({ note, onInvest }: NoteCardProps) {
  const progressDenominator = note.goalAmount > 0 ? note.goalAmount : 0;
  const fundingProgress =
    progressDenominator > 0
      ? Math.min(100, Math.round((note.fundedAmount / progressDenominator) * 100))
      : 0;

  return (
    <Card
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        note.isFeatured && "border-slate-200 bg-white"
      )}
    >
      <CardContent className="p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{note.title}</h3>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <BuildingOffice2Icon className="h-3.5 w-3.5" />
                  {note.industry}
                </span>
                <span className="inline-flex items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5" />
                  Note: {note.noteCode}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="More note actions"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-end">
              <span className="text-xs text-slate-500">{note.daysLeft} day(s) left</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-950 transition-all"
                style={{ width: `${fundingProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span>Funded {currency(note.fundedAmount)}</span>
              <span>Goal {currency(note.goalAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200">
            <div className="px-3 py-4 text-center">
              <div className="text-4xl font-semibold leading-none text-slate-900">{note.annualReturn}%</div>
              <div className="mt-1 text-[11px] text-slate-500">Per annum</div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-4xl font-semibold leading-none text-slate-900">{note.tenorDays}</div>
              <div className="mt-1 text-[11px] text-slate-500">Days</div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-4xl font-semibold leading-none text-slate-900">{note.riskScore}</div>
              <div className="mt-1 text-[11px] text-slate-500">Score</div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="default"
              size="lg"
              className={cn("h-10 w-full rounded-lg text-sm", MARKETPLACE_ACTION_BUTTON_CLASS)}
              disabled={!note.investable}
              onClick={() => note.investable && onInvest(note)}
            >
              {note.investable ? "Invest" : "Fully allocated"}
            </Button>
            <Button
              variant="ghost"
              className="h-7 w-full gap-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              Download info sheet
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
