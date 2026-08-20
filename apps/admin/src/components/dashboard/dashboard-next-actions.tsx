"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  NEXT_ACTIONS_AUTO_ADVANCE_MS,
  NEXT_ACTIONS_PAGE_SIZE,
  chunkQueuePages,
  formatQueueCount,
  nextQueuePageIndex,
  visibleQueuePageSize,
  type QuickActionQueue,
} from "./quick-action-queues";

function usePrefersReducedMotion() {
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduceMotion(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return reduceMotion;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function NextActionTile({ queue }: { queue: QuickActionQueue }) {
  const Icon = queue.icon;
  return (
    <Link
      href={queue.href}
      title={queue.description}
      aria-label={`${queue.title}, ${queue.count} ${queue.countLabel}`}
      className="group flex min-w-0 shrink-0 items-center gap-4 rounded-2xl px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-w-[14rem]"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-status-action-bg text-status-action-text">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-ui text-muted-foreground">{queue.shortTitle}</span>
        <span className="block text-page-title tabular-nums tracking-tight text-foreground">
          {formatQueueCount(queue.count)}
        </span>
        <span className="block text-meta text-muted-foreground">{queue.countLabel}</span>
      </span>
    </Link>
  );
}

function NextActionSkeletons({ count }: { count: number }) {
  return (
    <div className="flex justify-end gap-6 md:gap-10 xl:gap-12">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-w-0 items-center gap-4 px-3 py-2 md:min-w-[14rem]">
          <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CaughtUpState() {
  return (
    <div className="flex items-center justify-end gap-4 px-3 py-2">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-status-success-bg text-status-success-text">
        <CheckCircleIcon className="h-7 w-7" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-ui text-muted-foreground">Up next</p>
        <p className="text-section-title">All queues are clear</p>
      </div>
    </div>
  );
}

function NextQueuesButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Next queues"
      className="shrink-0"
      onClick={onClick}
    >
      <ChevronRightIcon className="h-5 w-5" />
    </Button>
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
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const pageSize = visibleQueuePageSize(width, needsAttention.length);
  const reduceMotion = usePrefersReducedMotion();
  const pages = React.useMemo(
    () => chunkQueuePages(needsAttention, pageSize),
    [needsAttention, pageSize]
  );
  const [page, setPage] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [tabHidden, setTabHidden] = React.useState(false);
  const showPager = pages.length > 1;

  React.useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  React.useEffect(() => {
    if (!showPager || paused || tabHidden || reduceMotion) return;
    const timer = window.setInterval(() => {
      setPage((current) => nextQueuePageIndex(current, pages.length));
    }, NEXT_ACTIONS_AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [page, pages.length, paused, reduceMotion, showPager, tabHidden]);

  if (queues.length === 0 && ready) return null;

  const safePage = pages.length === 0 ? 0 : page % pages.length;
  const skeletonCount = width > 0 ? pageSize : NEXT_ACTIONS_PAGE_SIZE;

  return (
    <div
      ref={ref}
      className="w-full min-w-0 xl:flex-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <p className="sr-only">Up next</p>
      {!ready ? (
        <NextActionSkeletons count={skeletonCount} />
      ) : needsAttention.length === 0 ? (
        <CaughtUpState />
      ) : (
        <div
          className="flex items-center gap-1 md:gap-2"
          aria-roledescription="carousel"
          aria-label="Queues that need attention"
        >
          <div className="flex min-w-0 flex-1 items-center justify-end gap-6 md:gap-10 xl:gap-12">
            {(pages[safePage] ?? []).map((queue) => (
              <NextActionTile key={queue.id} queue={queue} />
            ))}
          </div>
          {showPager ? (
            <NextQueuesButton
              onClick={() => setPage((current) => nextQueuePageIndex(current, pages.length))}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
