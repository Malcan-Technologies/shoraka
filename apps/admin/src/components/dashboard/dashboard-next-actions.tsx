"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { Skeleton } from "@cashsouk/ui";
import { formatQueueCount, type QuickActionQueue } from "./quick-action-queues";

function NextActionTile({ queue }: { queue: QuickActionQueue }) {
  const Icon = queue.icon;
  return (
    <Link
      href={queue.href}
      title={queue.description}
      aria-label={`${queue.title}, ${queue.count} ${queue.countLabel}`}
      className="group flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-status-action-text/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-action-text text-status-action-bg">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui text-foreground">{queue.shortTitle}</span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-section-title tabular-nums tracking-tight text-foreground">
            {formatQueueCount(queue.count)}
          </span>
          <span className="truncate text-meta text-muted-foreground">{queue.countLabel}</span>
        </span>
      </span>
    </Link>
  );
}

function NextActionSkeletons({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-w-0 items-center gap-3 px-2.5 py-2">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24 max-w-full" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CaughtUpState() {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-success-bg text-status-success-text">
        <CheckCircleIcon className="h-5 w-5" aria-hidden />
      </span>
      <p className="min-w-0 text-ui text-foreground">All queues are clear</p>
    </div>
  );
}

export function DashboardNextActions({
  queues,
  needsAttention,
  ready,
}: {
  queues: QuickActionQueue[];
  needsAttention: QuickActionQueue[];
  ready: boolean;
}) {
  if (queues.length === 0 && ready) return null;

  return (
    <div className="min-w-0 p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-card-title text-status-action-text">Up next</p>
        {ready && needsAttention.length > 0 ? (
          <p className="shrink-0 text-meta text-status-action-text">
            {needsAttention.length} {needsAttention.length === 1 ? "queue" : "queues"}
          </p>
        ) : null}
      </div>
      <div className="mt-3 min-w-0">
        {!ready ? (
          <NextActionSkeletons count={4} />
        ) : needsAttention.length === 0 ? (
          <CaughtUpState />
        ) : (
          <div
            className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 2xl:grid-cols-3"
            aria-label="Queues that need attention"
          >
            {needsAttention.map((queue) => (
              <NextActionTile key={queue.id} queue={queue} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
