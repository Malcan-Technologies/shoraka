"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ApprovalProgressStepper,
  getPersonalOnboardingSteps,
  getCompanyOnboardingSteps,
} from "./approval-progress-stepper";
import { SSMVerificationPanel } from "./ssm-verification-panel";
import type { OnboardingApplication } from "./onboarding-queue-table";
import {
  UserIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

interface OnboardingReviewDialogProps {
  application: OnboardingApplication;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// RegTank portal URLs
const REGTANK_PORTAL_URL = "https://shoraka-trial.regtank.com";

export function OnboardingReviewDialog({
  application,
  open,
  onOpenChange,
}: OnboardingReviewDialogProps) {
  const isCompany = application.type === "COMPANY";
  const steps = isCompany
    ? getCompanyOnboardingSteps(application.status)
    : getPersonalOnboardingSteps(application.status);

  const handleOpenRegTank = () => {
    window.open(REGTANK_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  const handleSSMApprove = () => {
    // In real implementation, this would call the API
    toast.success("SSM verification approved", {
      description: `Company ${application.companyDetails?.companyName} has been verified.`,
    });
    onOpenChange(false);
  };

  const handleSSMReject = () => {
    // In real implementation, this would call the API
    toast.error("SSM verification rejected", {
      description: `Company ${application.companyDetails?.companyName} has been rejected.`,
    });
    onOpenChange(false);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-MY", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const renderCurrentStepContent = () => {
    switch (application.status) {
      case "PENDING_SSM_REVIEW":
        return (
          <SSMVerificationPanel
            application={application}
            onApprove={handleSSMApprove}
            onReject={handleSSMReject}
          />
        );

      case "SSM_APPROVED":
      case "PENDING_ONBOARDING":
        return (
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5 text-accent" />
                Onboarding Approval Required
              </CardTitle>
              <CardDescription>
                The user has completed their identity verification on RegTank. You need to review
                and approve it in the RegTank admin portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Instructions:</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Click the button below to open RegTank portal</li>
                  <li>Search for the user by email: <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">{application.userEmail}</span></li>
                  <li>Review the submitted ID documents and liveness check</li>
                  <li>Approve or reject the onboarding request</li>
                  <li>Return here - status will update automatically via webhook</li>
                </ol>
              </div>
              <Button onClick={handleOpenRegTank} className="w-full gap-2">
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Open RegTank Portal
              </Button>
            </CardContent>
          </Card>
        );

      case "PENDING_AML":
        return (
          <Card className="border-[hsl(29.6_51%_28.8%)]/30 bg-[hsl(29.6_51%_28.8%)]/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5 text-[hsl(29.6_51%_28.8%)]" />
                AML Approval Required
              </CardTitle>
              <CardDescription>
                Onboarding has been approved. Now you need to complete the AML (Anti-Money
                Laundering) screening in RegTank.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Instructions:</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Click the button below to open RegTank portal</li>
                  <li>Navigate to the AML screening section</li>
                  <li>Search for the user by email: <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">{application.userEmail}</span></li>
                  <li>Review the AML screening results</li>
                  <li>Approve or reject based on the findings</li>
                </ol>
              </div>
              <Button onClick={handleOpenRegTank} className="w-full gap-2">
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Open RegTank Portal for AML Review
              </Button>
            </CardContent>
          </Card>
        );

      case "APPROVED":
        return (
          <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="font-semibold text-lg text-emerald-900 dark:text-emerald-100">
                    Onboarding Approved
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    This user has completed all verification steps and is fully approved.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "REJECTED":
        return (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircleIcon className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-lg text-destructive">Onboarding Rejected</p>
                  <p className="text-sm text-muted-foreground">
                    This application has been rejected. The user may need to resubmit their
                    application.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-3">
            Review Onboarding Application
            <Badge variant="outline" className="font-normal">
              {application.type === "PERSONAL" ? "Personal" : "Company"}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {application.portal}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review the application details and complete the required approval steps.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left Column - Progress Stepper */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approval Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ApprovalProgressStepper steps={steps} />
              </CardContent>
            </Card>

            {/* User Info Card */}
            <Card className="mt-4">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Applicant Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{application.userName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground break-all">
                    {application.userEmail}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {formatDate(application.submittedAt)}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">RegTank ID:</span>{" "}
                  <span className="font-mono">{application.regtankRequestId}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">User ID:</span>{" "}
                  <span className="font-mono">{application.userId}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Current Step Content */}
          <div className="lg:col-span-2">{renderCurrentStepContent()}</div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

