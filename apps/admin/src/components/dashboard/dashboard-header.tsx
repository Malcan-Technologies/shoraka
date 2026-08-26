"use client";

import { Card, welcomeBackTitle } from "@cashsouk/ui";
import { DashboardNextActions } from "./dashboard-next-actions";
import type { QuickActionQueue } from "./quick-action-queues";

export function DashboardHeader({
  displayName,
  description,
  queues,
  needsAttention,
  ready,
}: {
  displayName: string;
  description: string;
  queues: QuickActionQueue[];
  needsAttention: QuickActionQueue[];
  ready: boolean;
}) {
  const showQueues = queues.length > 0 || !ready;

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <div className="flex min-w-0 flex-col lg:flex-row">
        <div className="relative min-w-0 overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 md:p-6 lg:w-[min(36rem,48%)] lg:shrink-0 xl:w-[min(42rem,50%)] 2xl:w-[min(48rem,52%)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-primary/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-primary/5"
          />
          <div className="relative space-y-1.5">
            <h1 className="text-page-title text-primary">{welcomeBackTitle(displayName)}</h1>
            <p className="text-body text-muted-foreground">{description}</p>
          </div>
        </div>
        {showQueues ? (
          <div className="min-w-0 flex-1 border-t border-status-action-text/20 bg-status-action-bg lg:border-l lg:border-t-0">
            <DashboardNextActions
              queues={queues}
              needsAttention={needsAttention}
              ready={ready}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
