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

export type InvestmentListingData = {
  title: string | null;
  sector: string | null;
  noteRef: string | null;
  daysLeft: number | null;
  funded: number;
  goal: number;
  ratePercent: number | null;
  tenorDays: number | null;
  score: string | null;
};

export function formatRm(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

function textOrDash(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

export function InvestmentListingCard({
  data,
  ctaLabel = "Invest now",
  ctaHref = "/get-started",
  showDownloadLink = false,
  ctaClassName,
}: {
  data: InvestmentListingData;
  ctaLabel?: string;
  ctaHref?: string;
  showDownloadLink?: boolean;
  ctaClassName?: string;
}) {
  const pct =
    data.goal > 0 ? Math.min(100, Math.round((data.funded / data.goal) * 100)) : 0;

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {textOrDash(data.title)}
              </h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <BuildingOffice2Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {textOrDash(data.sector)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Note: {textOrDash(data.noteRef)}
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
                {data.daysLeft !== null ? `${data.daysLeft} day(s) left` : "-"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Funding progress"
              />
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-foreground">
              <span>Funded {formatRm(data.funded)}</span>
              <span>Goal {formatRm(data.goal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="px-3 py-4 text-center">
              <p className="text-4xl font-semibold leading-none text-foreground">
                {data.ratePercent !== null ? `${data.ratePercent}%` : "-"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Per annum</p>
            </div>
            <div className="px-3 py-4 text-center">
              <p className="text-4xl font-semibold leading-none text-foreground">
                {data.tenorDays ?? "-"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Days</p>
            </div>
            <div className="px-3 py-4 text-center">
              <p className="text-4xl font-semibold leading-none text-foreground">
                {textOrDash(data.score)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Score</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="px-0 pb-0 pt-0">
              <Button
                asChild
                className={cn(
                  "h-10 w-full rounded-lg text-sm bg-primary text-primary-foreground shadow-brand hover:opacity-95",
                  ctaClassName
                )}
              >
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            </div>
            {showDownloadLink ? (
              <Link
                href="#"
                className="flex items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Download info sheet
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
