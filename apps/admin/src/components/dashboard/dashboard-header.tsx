"use client";

import type { ReactNode } from "react";
import { Card, Skeleton, welcomeBackTitle } from "@cashsouk/ui";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  distressedPulseCopy,
  ledgerPulseCopy,
  par90PulseCopy,
  workQueuedPulseCopy,
} from "./dashboard-pulse";

export type PulseTileState<T> = { status: "ready"; value: T } | { status: "loading" } | { status: "hidden" };

function PulseDot({ tone }: { tone: "action" | "success" | "rejected" | "neutral" }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        tone === "action" && "bg-status-action-text",
        tone === "success" && "bg-status-success-text",
        tone === "rejected" && "bg-status-rejected-text",
        tone === "neutral" && "bg-status-neutral-text"
      )}
      aria-hidden
    />
  );
}

function PulseTileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-border px-5 py-4 sm:border-l sm:border-t-0">{children}</div>
  );
}

function PulseTileSkeleton() {
  return (
    <PulseTileShell>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-8 w-16" />
      <Skeleton className="mt-1 h-3 w-24" />
    </PulseTileShell>
  );
}

export function DashboardHeader({
  displayName,
  description,
  dataUpdatedAt,
  workQueued,
  ledger,
  par90,
  distressed,
}: {
  displayName: string;
  description: string;
  dataUpdatedAt?: number;
  workQueued: PulseTileState<{ items: number; queues: number }>;
  ledger: PulseTileState<{ balance: number }>;
  par90: PulseTileState<{ percent: number }>;
  distressed: PulseTileState<{ arrears: number; defaulted: number }>;
}) {
  const updatedLabel =
    dataUpdatedAt && dataUpdatedAt > 0
      ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })
      : null;
  const queued = workQueued.status === "ready" ? workQueuedPulseCopy(workQueued.value.items, workQueued.value.queues) : null;
  const ledgerCopy = ledger.status === "ready" ? ledgerPulseCopy(ledger.value.balance) : null;
  const parCopy = par90.status === "ready" ? par90PulseCopy(par90.value.percent) : null;
  const distressedCopy =
    distressed.status === "ready"
      ? distressedPulseCopy(distressed.value.arrears, distressed.value.defaulted)
      : null;

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,1.05fr)_minmax(0,1.4fr)]">
        <div className="relative min-w-0 overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 md:p-6">
          <p className="text-meta font-medium uppercase tracking-wide text-primary/75">Platform pulse</p>
          <h1 className="mt-1.5 text-page-title text-primary">{welcomeBackTitle(displayName)}</h1>
          <p className="mt-1.5 text-pretty text-ui text-muted-foreground">{description}</p>
          <p className="mt-3 text-meta text-muted-foreground">
            {updatedLabel ? `Updated ${updatedLabel} · refreshes every minute` : "refreshes every minute"}
          </p>
        </div>

        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4">
          {workQueued.status === "hidden" ? null : workQueued.status === "loading" || !queued ? (
            <PulseTileSkeleton />
          ) : (
            <PulseTileShell>
              <div className="flex items-center gap-1.5">
                <PulseDot tone="action" />
                <span className="text-meta text-muted-foreground">Work queued</span>
              </div>
              <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-status-action-text">
                {queued.itemsLabel}
              </p>
              <p className="text-meta text-muted-foreground">{queued.subtitle}</p>
            </PulseTileShell>
          )}

          {ledger.status === "hidden" ? null : ledger.status === "loading" || !ledgerCopy ? (
            <PulseTileSkeleton />
          ) : (
            <PulseTileShell>
              <div className="flex items-center gap-1.5">
                <PulseDot tone={ledgerCopy.tone} />
                <span className="text-meta text-muted-foreground">Ledger</span>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-2xl font-bold tabular-nums tracking-tight",
                  ledgerCopy.tone === "success" ? "text-status-success-text" : "text-status-rejected-text"
                )}
              >
                {ledgerCopy.label}
              </p>
              <p className="text-meta text-muted-foreground">{ledgerCopy.netLabel}</p>
            </PulseTileShell>
          )}

          {par90.status === "hidden" ? null : par90.status === "loading" || !parCopy ? (
            <PulseTileSkeleton />
          ) : (
            <PulseTileShell>
              <div className="flex items-center gap-1.5">
                <PulseDot tone={parCopy.tone} />
                <span className="text-meta text-muted-foreground">PAR90</span>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-2xl font-bold tabular-nums tracking-tight",
                  parCopy.tone === "success" ? "text-status-success-text" : "text-status-rejected-text"
                )}
              >
                {parCopy.percentLabel}
              </p>
              <p className="text-meta text-muted-foreground">{parCopy.subtitle}</p>
            </PulseTileShell>
          )}

          {distressed.status === "hidden" ? null : distressed.status === "loading" || !distressedCopy ? (
            <PulseTileSkeleton />
          ) : (
            <PulseTileShell>
              <div className="flex items-center gap-1.5">
                <PulseDot tone={distressedCopy.tone === "rejected" ? "rejected" : "neutral"} />
                <span className="text-meta text-muted-foreground">Distressed</span>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-2xl font-bold tabular-nums tracking-tight",
                  distressedCopy.tone === "rejected" ? "text-status-rejected-text" : "text-foreground"
                )}
              >
                {distressedCopy.total}
              </p>
              <p className="text-meta text-muted-foreground">{distressedCopy.subtitle}</p>
            </PulseTileShell>
          )}
        </div>
      </div>
    </Card>
  );
}
