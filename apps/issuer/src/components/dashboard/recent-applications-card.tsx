"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Card } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApplicationsData } from "@/app/(application-management)/applications/use-applications-data";
import type { NormalizedApplication } from "@/app/(application-management)/applications/status";
import { RecentSectionHeader } from "@/components/dashboard/recent-section-header";

const MAX_ROWS = 4;

function isActionable(app: NormalizedApplication): boolean {
  return app.cardStatus.showMakeAmendments || app.cardStatus.showReviewOffer;
}

function statusLabel(app: NormalizedApplication): string {
  return app.cardStatus.displayLabel;
}

function statusTone(app: NormalizedApplication): string {
  if (app.cardStatus.showMakeAmendments) return "border-amber-500/30 bg-amber-50 text-amber-800";
  if (app.cardStatus.showReviewOffer) return "border-emerald-500/30 bg-emerald-50 text-emerald-800";
  return "border-border bg-muted text-muted-foreground";
}

function displayId(app: NormalizedApplication): string {
  return "#" + app.id.slice(-8).toUpperCase();
}

export function RecentApplicationsCard() {
  const { applications, isLoading } = useApplicationsData();

  const prioritized = applications
    .slice()
    .sort((a, b) => {
      const ai = isActionable(a) ? 0 : 1;
      const bi = isActionable(b) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const visible = prioritized.slice(0, MAX_ROWS);
  const actionableCount = applications.filter(isActionable).length;

  return (
    <Card className="bg-muted/50 shadow-none">
      <RecentSectionHeader
        title="Recent applications"
        countBadge={
          actionableCount > 0 ? (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              {actionableCount} action{actionableCount === 1 ? "" : "s"} required
            </Badge>
          ) : null
        }
        viewAllHref="/applications"
      />
      <div className="px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
        {isLoading ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">
            No applications yet.{" "}
            <Link href="/applications/new" className="font-medium text-primary underline-offset-4 hover:underline">
              Apply for financing
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {visible.map((app) => {
              const href = app.cardStatus.showMakeAmendments
                ? `/applications/edit/${app.id}`
                : "/applications";
              return (
                <li key={app.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-foreground">
                          Application {displayId(app)}
                        </span>
                        <span className="text-sm text-muted-foreground">{app.type}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {app.customer}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0", statusTone(app))}>
                      {statusLabel(app)}
                    </Badge>
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

