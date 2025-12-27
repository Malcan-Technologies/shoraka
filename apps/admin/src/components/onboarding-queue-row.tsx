"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EyeIcon } from "@heroicons/react/24/outline";
import { OnboardingReviewDialog } from "./onboarding-review-dialog";
import type { OnboardingApplicationResponse, OnboardingApprovalStatus } from "@cashsouk/types";

interface OnboardingQueueRowProps {
  application: OnboardingApplicationResponse;
}

function getStatusBadge(status: OnboardingApprovalStatus) {
  switch (status) {
    case "PENDING_SSM_REVIEW":
      return (
        <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
          Pending SSM Review
        </Badge>
      );
    case "PENDING_ONBOARDING":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Pending Onboarding
        </Badge>
      );
    case "PENDING_APPROVAL":
      return (
        <Badge className="bg-yellow-500 text-yellow-950 hover:bg-yellow-600">
          Pending Approval
        </Badge>
      );
    case "PENDING_AML":
      return <Badge className="bg-orange-500 text-white hover:bg-orange-600">Pending AML</Badge>;
    case "APPROVED":
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
    case "EXPIRED":
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          Expired
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getTypeBadge(type: "PERSONAL" | "COMPANY") {
  if (type === "PERSONAL") {
    return (
      <Badge variant="outline" className="border-primary/30 text-primary">
        Personal
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[hsl(29.6_51%_28.8%)]/30 text-[hsl(29.6_51%_28.8%)]">
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

function formatDate(dateString: string) {
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

  // Admin action required for SSM review, approval, and AML (not pending onboarding - that's user action)
  const needsAction =
    application.status === "PENDING_SSM_REVIEW" ||
    application.status === "PENDING_APPROVAL" ||
    application.status === "PENDING_AML";

  return (
    <>
      <TableRow className={needsAction ? "bg-muted/30" : undefined}>
        <TableCell>
          <div className="space-y-0.5">
            <div className="font-medium text-[15px]">{application.userName}</div>
            <div className="text-sm text-muted-foreground">{application.userEmail}</div>
            {application.type === "COMPANY" && application.registrationNumber && (
              <div className="text-xs text-muted-foreground">
                SSM: {application.registrationNumber}
              </div>
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
        <TableCell>{getStatusBadge(application.status)}</TableCell>
        <TableCell>
          <Button
            variant={needsAction ? "default" : "outline"}
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5"
          >
            <EyeIcon className="h-4 w-4" />
            Review
          </Button>
        </TableCell>
      </TableRow>

      <OnboardingReviewDialog
        application={application}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
