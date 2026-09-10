"use client";

import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { DashboardSectionHeader } from "./dashboard-section-header";
import {
  formatQueueCount,
  queueCardTone,
  queueProgressPercent,
  type QuickActionQueue,
} from "./quick-action-queues";

function QueueCard({ queue, maxCount }: { queue: QuickActionQueue; maxCount: number }) {
  const Icon = queue.icon;
  const tone = queueCardTone(queue);
  const progress = queueProgressPercent(queue.count, maxCount);
  const distressed = tone === "rejected" && queue.id === "default-eligible";

  return (
    <Link
      href={queue.href}
      title={queue.description}
      aria-label={`${queue.title}, ${queue.count} ${queue.countLabel}`}
      className="min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={cn(
          "rounded-2xl border-l-[3px] shadow-sm transition-colors hover:bg-muted/40",
          tone === "rejected" ? "border-l-status-rejected-text" : "border-l-status-action-text",
          distressed && "bg-status-rejected-bg"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                distressed
                  ? "bg-status-rejected-bg text-status-rejected-text"
                  : "bg-status-action-bg text-status-action-text"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui font-medium text-foreground">{queue.title}</p>
              <p className="truncate text-meta text-muted-foreground">{queue.description}</p>
            </div>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums tracking-tight",
                distressed ? "text-status-rejected-text" : "text-foreground"
              )}
            >
              {formatQueueCount(queue.count)}
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                tone === "rejected" ? "bg-status-rejected-text" : "bg-status-action-text"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QueueSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="h-3 w-36 max-w-full" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
            <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardNextActions({
  queues,
  needsAttention,
  ready,
  totalOpenItems,
}: {
  queues: QuickActionQueue[];
  needsAttention: QuickActionQueue[];
  ready: boolean;
  totalOpenItems: number;
}) {
  const clearQueues = queues.filter((queue) => !queue.isLoading && queue.count === 0);
  const maxCount = Math.max(0, ...needsAttention.map((queue) => queue.count));

  return (
    <section>
      <DashboardSectionHeader
        title="Up next"
        subtitle="Queues waiting on CashSouk, most urgent first"
        action={
          ready && needsAttention.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-action-bg px-3 py-1 text-ui text-status-action-text">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden />
              {totalOpenItems} {totalOpenItems === 1 ? "item" : "items"} open
            </span>
          ) : null
        }
      />

      {!ready ? (
        <QueueSkeletons />
      ) : (
        <>
          {needsAttention.length > 0 ? (
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Queues that need attention"
            >
              {needsAttention.map((queue) => (
                <QueueCard key={queue.id} queue={queue} maxCount={maxCount} />
              ))}
            </div>
          ) : null}

          {clearQueues.length > 0 ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm",
                needsAttention.length > 0 && "mt-3"
              )}
            >
              <span className="inline-flex items-center gap-1.5 text-meta text-status-success-text">
                <CheckCircleIcon className="h-4 w-4" aria-hidden />
                Clear
              </span>
              {clearQueues.map((queue) => (
                <Link
                  key={queue.id}
                  href={queue.href}
                  className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-ui text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  {queue.shortTitle} · 0
                </Link>
              ))}
            </div>
          ) : needsAttention.length === 0 ? (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-success-bg text-status-success-text">
                  <CheckCircleIcon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-ui text-foreground">All queues are clear</p>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </section>
  );
}
