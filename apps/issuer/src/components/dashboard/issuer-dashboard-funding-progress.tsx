"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import type { IssuerBookFundingProgress } from "@cashsouk/types";
import { formatNoteReference } from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { FUNDING_PROGRESS_PAGE_SIZE } from "./issuer-dashboard-display";
import { DashboardSectionHeader } from "./dashboard-section-header";
import { DashboardPipelineStep } from "./dashboard-pipeline-step";
import {
  nextDashboardVisibleCount,
  pipelineStepStates,
  resolveNotePipeline,
} from "./where-things-stand";

function fundingHint(item: IssuerBookFundingProgress): string | null {
  const tenor = item.tenorDays != null ? `${item.tenorDays}-day tenor` : null;
  const remaining =
    item.status === "pending_listing"
      ? "waiting to be listed"
      : item.status === "failed"
        ? "listing did not fill"
        : item.status === "funded"
          ? item.percent >= 100
            ? "fully funded, awaiting disbursement"
            : "funded, awaiting disbursement"
          : item.daysLeft == null
            ? null
            : item.daysLeft < 0
              ? "listing closed"
              : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`;
  const parts = [tenor, remaining].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function IssuerDashboardFundingProgress({
  items,
}: {
  items: IssuerBookFundingProgress[];
}) {
  const [visibleCount, setVisibleCount] = useState(FUNDING_PROGRESS_PAGE_SIZE);
  if (items.length === 0) return null;

  const raising = items.filter((item) => item.status === "open" || item.status === "funded");
  const raised = raising.reduce((sum, item) => sum + item.fundedAmount, 0);
  const stillToRaise = items
    .filter((item) => item.status === "pending_listing" || item.status === "open")
    .reduce((sum, item) => sum + Math.max(0, item.targetAmount - item.fundedAmount), 0);
  const visible = items.slice(0, visibleCount);
  const hiddenCount = Math.max(0, items.length - visible.length);
  const nextCount = Math.min(FUNDING_PROGRESS_PAGE_SIZE, hiddenCount);

  return (
    <section>
      <DashboardSectionHeader
        title="Funding progress"
        subtitle="Notes waiting to list, raise, or disburse"
        action={
          <Link href="/financing" className="text-ui font-medium text-primary hover:text-accent">
            All notes →
          </Link>
        }
      />
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <ul>
          {visible.map((item, index) => {
            const pipeline = resolveNotePipeline(item.status);
            const states = pipelineStepStates(
              pipeline.steps.length,
              pipeline.currentIndex,
              pipeline.failed,
              1
            );
            const showDivider = index < visible.length - 1 || hiddenCount > 0;
            const hint = fundingHint(item);
            const reference = formatNoteReference({
              noteReference: item.noteReference,
              id: item.noteId,
            });
            return (
              <li
                key={item.noteId}
                className={cn(
                  "p-5 md:px-6",
                  showDivider && "border-b border-border",
                  item.status === "failed" && "bg-status-rejected-bg/40"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/financing/notes/${item.noteId}`}
                      className="text-ui font-semibold tabular-nums hover:text-accent"
                    >
                      {reference}
                    </Link>
                    {hint ? <p className="mt-1 text-ui text-muted-foreground">{hint}</p> : null}
                  </div>
                  {item.status !== "pending_listing" ? (
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-ui font-semibold tabular-nums",
                          item.status === "funded" && "text-status-success-text",
                          item.status === "failed" && "text-status-rejected-text"
                        )}
                      >
                        {Math.round(item.percent)}%
                      </p>
                      <p className="text-meta tabular-nums text-muted-foreground">
                        {formatCurrency(item.fundedAmount, { decimals: 0 })} /{" "}
                        {formatCurrency(item.targetAmount, { decimals: 0, includeSymbol: false })}
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {pipeline.steps.map((label, stepIndex) => (
                    <DashboardPipelineStep
                      key={label}
                      label={label}
                      state={states[stepIndex] ?? "upcoming"}
                      yourTurn={false}
                    />
                  ))}
                </div>
                {item.status === "open" || item.status === "funded" || item.status === "failed" ? (
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        item.status === "funded" && "bg-status-success-text",
                        item.status === "failed" && "bg-status-rejected-text",
                        item.status === "open" && "bg-primary"
                      )}
                      style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
          {hiddenCount > 0 ? (
            <li className="px-5 py-3.5 md:px-6">
              <button
                type="button"
                className="text-ui font-medium text-primary hover:text-accent"
                onClick={() =>
                  setVisibleCount((current) =>
                    nextDashboardVisibleCount(current, items.length, FUNDING_PROGRESS_PAGE_SIZE)
                  )
                }
              >
                {nextCount === 1 ? "Load 1 more" : `Load ${nextCount} more`}
              </button>
            </li>
          ) : null}
        </ul>
        {raising.length > 0 || stillToRaise > 0 ? (
          <div className="flex flex-wrap gap-7 border-t border-border px-5 py-4 md:px-6">
            <div>
              <p className="text-meta text-muted-foreground">Raised across open notes</p>
              <p className="mt-0.5 text-body font-semibold tabular-nums">
                {formatCurrency(raised, { decimals: 0 })}
              </p>
            </div>
            <div>
              <p className="text-meta text-muted-foreground">Still to raise</p>
              <p className="mt-0.5 text-body font-semibold tabular-nums">
                {formatCurrency(stillToRaise, { decimals: 0 })}
              </p>
            </div>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
