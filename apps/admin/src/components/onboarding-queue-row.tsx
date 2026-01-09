"use client";

import * as React from "react";
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
import { useRefreshOnboardingApplication } from "@/hooks/use-onboarding-applications";
import { toast } from "sonner";
import type { OnboardingApplicationResponse, OnboardingApprovalStatus } from "@cashsouk/types";

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
          Pending SSM Review
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
      return <Badge variant="secondary">{status}</Badge>;
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
  const [currentApplication, setCurrentApplication] =
    React.useState<OnboardingApplicationResponse>(application);
  const refreshMutation = useRefreshOnboardingApplication();

  // Update current application when prop changes (e.g., after list refresh)
  React.useEffect(() => {
    setCurrentApplication(application);
  }, [application]);

  const handleRefresh = () => {
    refreshMutation.mutate(application.id, {
      onSuccess: (updatedApplication) => {
        setCurrentApplication(updatedApplication);
        toast.success("Application refreshed", {
          description: `Status: ${updatedApplication.status.replace(/_/g, " ").toLowerCase()}`,
        });
      },
      onError: (error) => {
        toast.error("Failed to refresh application", {
          description: error.message,
        });
      },
    });
  };

  // Admin action required for approval, AML, SSM review, or final approval (not pending onboarding - that's user action)
  const needsAction =
    currentApplication.status === "PENDING_APPROVAL" ||
    currentApplication.status === "PENDING_AML" ||
    currentApplication.status === "PENDING_SSM_REVIEW" ||
    currentApplication.status === "PENDING_FINAL_APPROVAL";

  return (
    <>
      <TableRow className={needsAction ? "bg-muted/30" : undefined}>
        <TableCell className="min-w-[180px] max-w-[280px]">
          <div className="space-y-0.5 min-w-0">
            {currentApplication.type === "COMPANY" ? (
              <>
                <div
                  className="font-medium text-sm truncate"
                  title={currentApplication.organizationName || "Unnamed Organization"}
                >
                  {currentApplication.organizationName || "Unnamed Organization"}
                </div>
                <div
                  className="text-sm text-muted-foreground truncate"
                  title={currentApplication.userEmail}
                >
                  {currentApplication.userEmail}
                </div>
                {currentApplication.registrationNumber && (
                  <div
                    className="text-xs text-muted-foreground truncate"
                    title={`SSM: ${currentApplication.registrationNumber}`}
                  >
                    SSM: {currentApplication.registrationNumber}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-medium text-sm truncate" title={currentApplication.userName}>
                  {currentApplication.userName}
                </div>
                <div
                  className="text-sm text-muted-foreground truncate"
                  title={currentApplication.userEmail}
                >
                  {currentApplication.userEmail}
                </div>
              </>
            )}
          </div>
        </TableCell>
        <TableCell>{getTypeBadge(currentApplication.type)}</TableCell>
        <TableCell>{getPortalBadge(currentApplication.portal)}</TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {formatDate(currentApplication.submittedAt)}
          </span>
        </TableCell>
        <TableCell>
          {currentApplication.completedAt ? (
            <span className="text-sm text-muted-foreground">
              {formatDate(currentApplication.completedAt)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground/50">—</span>
          )}
        </TableCell>
        <TableCell>{getStatusBadge(currentApplication.status)}</TableCell>
        <TableCell>
          {currentApplication.status !== "CANCELLED" && (
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
        application={currentApplication}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRefresh={handleRefresh}
        isRefreshing={refreshMutation.isPending}
      />
    </>
  );
}
