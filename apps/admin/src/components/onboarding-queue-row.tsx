"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EyeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import { OnboardingReviewDialog } from "./onboarding-review-dialog";
import { toTitleCase, type OnboardingApplicationResponse, type OnboardingApprovalStatus } from "@cashsouk/types";

interface OnboardingQueueRowProps {
  application: OnboardingApplicationResponse;
}

function getStatusBadge(status: OnboardingApprovalStatus) {
  switch (status) {
    case "PENDING_ONBOARDING":
      return (
        <Badge variant="outline" className="border-slate-500/30 text-foreground bg-slate-500/10">
          <ClockIcon className="h-3 w-3 mr-1 text-slate-600" />
          In Progress
        </Badge>
      );
    case "PENDING_APPROVAL":
      return (
        <Badge variant="outline" className="border-yellow-500/30 text-foreground bg-yellow-500/10">
          <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-yellow-600" />
          Pending Approval
        </Badge>
      );
    case "PENDING_AML":
      return (
        <Badge variant="outline" className="border-orange-500/30 text-foreground bg-orange-500/10">
          <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-orange-600" />
          Pending AML
        </Badge>
      );
    case "PENDING_SSM_REVIEW":
      return (
        <Badge variant="outline" className="border-amber-600/30 text-foreground bg-amber-600/10">
          <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-amber-600" />
          Pending CTOS Review
        </Badge>
      );
    case "PENDING_FINAL_APPROVAL":
      return (
        <Badge variant="outline" className="border-purple-500/30 text-foreground bg-purple-500/10">
          <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-purple-600" />
          Pending Final Approval
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge
          variant="outline"
          className="border-emerald-600/30 text-foreground bg-emerald-600/10"
        >
          <CheckCircleIcon className="h-3 w-3 mr-1 text-emerald-600" />
          Completed
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className="border-red-500/30 text-foreground bg-red-500/10">
          <XCircleIcon className="h-3 w-3 mr-1 text-red-600" />
          Rejected
        </Badge>
      );
    case "EXPIRED":
      return (
        <Badge variant="outline" className="border-slate-400/30 text-foreground bg-slate-400/10">
          <ClockIcon className="h-3 w-3 mr-1 text-slate-500" />
          Expired
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline" className="border-slate-400/30 text-foreground bg-slate-400/10">
          <XCircleIcon className="h-3 w-3 mr-1 text-slate-500" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{toTitleCase(String(status))}</Badge>;
  }
}

function getTypeBadge(type: "PERSONAL" | "COMPANY") {
  if (type === "PERSONAL") {
    return (
      <Badge variant="outline" className="border-slate-500/30 text-foreground bg-slate-500/10">
        <UserIcon className="h-3 w-3 mr-1 text-slate-600" />
        Personal
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10">
      <BuildingOffice2Icon className="h-3 w-3 mr-1 text-blue-600" />
      Company
    </Badge>
  );
}

function getPortalBadge(portal: "investor" | "issuer") {
  if (portal === "investor") {
    return <Badge variant="secondary">Investor</Badge>;
  }
  return (
    <Badge variant="secondary" className="bg-muted">
      Issuer
    </Badge>
  );
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

  const needsAction =
    application.onboardingStatus === "PENDING_APPROVAL" ||
    application.onboardingStatus === "PENDING_AML" ||
    application.onboardingStatus === "PENDING_SSM_REVIEW" ||
    application.onboardingStatus === "PENDING_FINAL_APPROVAL";

  return (
    <>
      <TableRow className={needsAction ? "bg-muted/30" : undefined}>
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
                {application.directorShareholderAmlPending ? (
                  <Badge variant="secondary" className="mt-1 w-fit rounded-full text-xs font-semibold">
                    Pending Directors/Shareholders
                  </Badge>
                ) : null}
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
        <TableCell>{getTypeBadge(application.type)}</TableCell>
        <TableCell>{getPortalBadge(application.portal)}</TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {formatDate(application.submittedAt)}
          </span>
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
        <TableCell>{getStatusBadge(displayStatus)}</TableCell>
        <TableCell>
          {application.status !== "CANCELLED" && (
            <Button
              variant={needsAction ? "default" : "outline"}
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5"
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
