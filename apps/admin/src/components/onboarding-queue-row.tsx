"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EyeIcon } from "@heroicons/react/24/outline";
import { OnboardingReviewDialog } from "./onboarding-review-dialog";
import type { OnboardingApplication, OnboardingApprovalStatus } from "./onboarding-queue-table";

interface OnboardingQueueRowProps {
  application: OnboardingApplication;
}

function getStatusBadge(status: OnboardingApprovalStatus) {
  switch (status) {
    case "PENDING_SSM_REVIEW":
      return (
        <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
          Pending SSM Review
        </Badge>
      );
    case "SSM_APPROVED":
      return (
        <Badge className="bg-[hsl(29.6_51%_28.8%)] text-white hover:bg-[hsl(29.6_51%_24%)]">
          SSM Approved
        </Badge>
      );
    case "PENDING_ONBOARDING":
      return (
        <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">
          Pending Onboarding
        </Badge>
      );
    case "PENDING_AML":
      return (
        <Badge className="bg-[hsl(29.6_51%_28.8%)] text-white hover:bg-[hsl(29.6_51%_24%)]">
          Pending AML
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
          Approved
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="destructive">
          Rejected
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

function getPortalBadge(portal: "INVESTOR" | "ISSUER") {
  if (portal === "INVESTOR") {
    return (
      <Badge variant="secondary">
        Investor
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-muted">
      Issuer
    </Badge>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function OnboardingQueueRow({ application }: OnboardingQueueRowProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const needsAction =
    application.status === "PENDING_SSM_REVIEW" ||
    application.status === "SSM_APPROVED" ||
    application.status === "PENDING_ONBOARDING" ||
    application.status === "PENDING_AML";

  return (
    <>
      <TableRow className={needsAction ? "bg-muted/30" : undefined}>
        <TableCell>
          <div className="space-y-0.5">
            <div className="font-medium text-[15px]">{application.userName}</div>
            <div className="text-sm text-muted-foreground">{application.userEmail}</div>
            {application.companyDetails && (
              <div className="text-xs text-muted-foreground">
                SSM: {application.companyDetails.registrationNumber}
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

