"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PortalBadge, StatusBadge } from "@cashsouk/ui";
import { EyeIcon } from "@heroicons/react/24/outline";
import { OnboardingReviewDialog } from "./onboarding-review-dialog";
import type { OnboardingApplicationResponse, OnboardingApprovalStatus } from "@cashsouk/types";
import { usePermissions } from "@/hooks/use-permissions";
import { OrganizationTypeBadge } from "@/components/organization-type-badge";
import { getOnboardingQueuePresentation } from "@/lib/organization-status";
import { adminActionRowClass } from "@/lib/admin-status-token";

interface OnboardingQueueRowProps {
  application: OnboardingApplicationResponse;
}

function getPortalBadge(portal: "investor" | "issuer") {
  return <PortalBadge portal={portal} />;
}

function queueRowDisplayStatus(app: OnboardingApplicationResponse): OnboardingApprovalStatus {
  if (app.status === "EXPIRED" || app.status === "CANCELLED") {
    return app.status;
  }
  const raw = app.onboardingStatus;
  if (raw === "PENDING" || raw === "IN_PROGRESS") {
    return "PENDING_ONBOARDING";
  }
  return raw as OnboardingApprovalStatus;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function OnboardingQueueRow({ application }: OnboardingQueueRowProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManageOnboarding = can("onboarding.manage");

  React.useEffect(() => {
    if (!dialogOpen) return;
    void queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
  }, [dialogOpen, queryClient]);

  const handleDialogOpenChange = (next: boolean) => {
    setDialogOpen(next);
    if (!next) {
      void queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
    }
  };

  const displayStatus = queueRowDisplayStatus(application);
  const presentation = getOnboardingQueuePresentation(displayStatus);

  const needsAction =
    application.onboardingStatus === "PENDING_APPROVAL" ||
    application.onboardingStatus === "PENDING_AML" ||
    application.onboardingStatus === "PENDING_SSM_REVIEW" ||
    application.onboardingStatus === "PENDING_AMENDMENT" ||
    application.onboardingStatus === "PENDING_FINAL_APPROVAL";

  return (
    <>
      <TableRow className={adminActionRowClass(presentation.status)}>
        <TableCell className="min-w-[180px] max-w-[280px]">
          <div className="space-y-0.5 min-w-0">
            {application.type === "COMPANY" ? (
              <>
                <div
                  className="font-medium text-sm truncate"
                  title={application.organizationName || "Unnamed Organization"}
                >
                  {application.organizationName || "Unnamed Organization"}
                </div>
                <div
                  className="text-sm text-muted-foreground truncate"
                  title={application.userEmail}
                >
                  {application.userEmail}
                </div>
                {application.registrationNumber && (
                  <div
                    className="text-xs text-muted-foreground truncate"
                    title={`SSM: ${application.registrationNumber}`}
                  >
                    SSM: {application.registrationNumber}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-medium text-sm truncate" title={application.userName}>
                  {application.userName}
                </div>
                <div
                  className="text-sm text-muted-foreground truncate"
                  title={application.userEmail}
                >
                  {application.userEmail}
                </div>
              </>
            )}
          </div>
        </TableCell>
        <TableCell>
          <OrganizationTypeBadge type={application.type} />
        </TableCell>
        <TableCell>{getPortalBadge(application.portal)}</TableCell>
        <TableCell>
          {application.submittedAt ? (
            <span className="text-sm text-muted-foreground">
              {formatDate(application.submittedAt)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground/50">—</span>
          )}
        </TableCell>
        <TableCell>
          {application.completedAt ? (
            <span className="text-sm text-muted-foreground">
              {formatDate(application.completedAt)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground/50">—</span>
          )}
        </TableCell>
        <TableCell>
          <StatusBadge label={presentation.label} status={presentation.status} />
        </TableCell>
        <TableCell>
          {application.status !== "CANCELLED" && (
            <Button
              variant={needsAction ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (!canManageOnboarding) return;
                setDialogOpen(true);
              }}
              className="gap-1.5"
              disabled={!canManageOnboarding}
              title={
                !canManageOnboarding ? "You do not have permission to perform this action." : undefined
              }
            >
              <EyeIcon className="h-4 w-4" />
              Review
            </Button>
          )}
        </TableCell>
      </TableRow>

      <OnboardingReviewDialog
        onboardingId={application.id}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
      />
    </>
  );
}
