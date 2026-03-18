"use client";

/**
 * Dev-only page: shows all status badge examples.
 * URL: /dev/status-examples
 * Only available when NODE_ENV === "development".
 */

import { notFound } from "next/navigation";
import { getStatusPresentation, STATUS_EXAMPLE_KEYS } from "@cashsouk/config";
import { WithdrawReason } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BADGE_BASE = "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border";

export default function StatusExamplesPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Status Badge Examples</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dev-only. All statuses from @cashsouk/config status-badges.
          </p>
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-semibold">API statuses</h2>
          <div className="flex flex-wrap gap-3">
            {STATUS_EXAMPLE_KEYS.map((key) => {
              const pres = getStatusPresentation(
                key,
                key === "WITHDRAWN" ? WithdrawReason.USER_CANCELLED : undefined
              );
              return (
                <div key={key} className="flex flex-col items-start gap-1">
                  <Badge
                    variant="outline"
                    className={cn(BADGE_BASE, pres.badgeClass)}
                  >
                    <span
                      className={cn("mr-1.5 h-2 w-2 rounded-full shrink-0", pres.dotClass)}
                      aria-hidden
                    />
                    {pres.label}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {key}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Withdrawn variants</h2>
          <div className="flex flex-wrap gap-3">
            {[WithdrawReason.USER_CANCELLED, WithdrawReason.OFFER_EXPIRED, WithdrawReason.OFFER_REJECTED].map((reason) => {
              const pres = getStatusPresentation("WITHDRAWN", reason);
              return (
                <div key={reason} className="flex flex-col items-start gap-1">
                  <Badge
                    variant="outline"
                    className={cn(BADGE_BASE, pres.badgeClass)}
                  >
                    <span
                      className={cn("mr-1.5 h-2 w-2 rounded-full shrink-0", pres.dotClass)}
                      aria-hidden
                    />
                    {pres.label}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    WITHDRAWN + {reason}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
