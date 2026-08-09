"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Card } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApplicationsData } from "@/app/(application-management)/applications/use-applications-data";
import {
  countIssuerApplicationsNeedingAction,
  isIssuerApplicationActionable,
  type NormalizedApplication,
} from "@/app/(application-management)/applications/status";
import {
  actionsRequiredLabel,
  issuerApplicationActionHref,
} from "@/lib/issuer-pending-actions";
import { RecentSectionHeader } from "@/components/dashboard/recent-section-header";
import { ApplyForFinancingButton } from "@/components/apply-for-financing-button";
import { formatApplicationReference } from "@cashsouk/types";

const MAX_ROWS = 4;

function statusLabel(app: NormalizedApplication): string {
  if (String(app.offerAcceptanceStatus ?? "").toUpperCase() === "CHANGES_REQUESTED") {
    return "Changes requested";
  }
  return app.cardStatus.displayLabel;
}

function statusTone(app: NormalizedApplication): string {
  if (isIssuerApplicationActionable(app)) {
    return "border-status-action-text/30 bg-status-action-bg text-status-action-text";
  }
  return "border-border bg-muted text-muted-foreground";
}

function displayId(app: NormalizedApplication): string {
  return formatApplicationReference({
    displayReference: app.displayReference,
    id: app.id,
  });
}

export function RecentApplicationsCard() {
  const { applications, isLoading } = useApplicationsData();

  const prioritized = applications
    .slice()
    .sort((a, b) => {
      const ai = isIssuerApplicationActionable(a) ? 0 : 1;
      const bi = isIssuerApplicationActionable(b) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const visible = prioritized.slice(0, MAX_ROWS);
  const actionableCount = countIssuerApplicationsNeedingAction(applications);

  return (
    <Card className={cn("flex h-full flex-col")}>
      <RecentSectionHeader
        title="Recent applications"
        countBadge={
          actionableCount > 0 ? (
            <Badge className="bg-status-action-bg text-status-action-text hover:bg-status-action-bg">
              {actionsRequiredLabel(actionableCount)}
            </Badge>
          ) : null
        }
        viewAllHref="/applications"
      />
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
        {isLoading ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">
            No applications yet.{" "}
            <ApplyForFinancingButton
              variant="link"
              showIcon={false}
              className="inline h-auto p-0 text-[17px] font-medium leading-7"
            />
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {visible.map((app) => {
              const href = issuerApplicationActionHref(app);
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

