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
import { useOrganization } from "@cashsouk/config";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface CorporateOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function CorporateOnboardingModal({
  open,
  onOpenChange,
  organizationId,
}: CorporateOnboardingModalProps) {
  const { organizations, refreshOrganizations } = useOrganization();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const organization = organizations.find((org) => org.id === organizationId);
  const onboardingStatus = organization?.onboardingStatus;
  const regtankStatus = organization?.regtankOnboardingStatus;
  const verifyLink = organization?.regtankVerifyLink;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshOrganizations();
    } catch (error) {
      console.error("[CorporateOnboardingModal] Failed to refresh status:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenRegTank = () => {
    if (verifyLink) {
      window.open(verifyLink, "_blank");
    }
  };

  const getStatusMessage = () => {
    if (onboardingStatus === "COMPLETED") {
      return "Onboarding completed successfully";
    }
    if (onboardingStatus === "PENDING_APPROVAL") {
      return "Waiting for admin approval";
    }
    if (onboardingStatus === "PENDING_AML") {
      return "Waiting for AML approval";
    }
    if (onboardingStatus === "PENDING_SSM_REVIEW") {
      return "Waiting for SSM verification";
    }
    if (onboardingStatus === "PENDING_FINAL_APPROVAL") {
      return "Waiting for final approval";
    }
    if (onboardingStatus === "REJECTED") {
      return "Onboarding was rejected";
    }
    return "Onboarding in progress";
  };

  const isCompleted = onboardingStatus === "COMPLETED";
  const isRejected = onboardingStatus === "REJECTED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Company Account Onboarding</DialogTitle>
          <DialogDescription>
            {getStatusMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span className="text-sm font-medium">
              {onboardingStatus || regtankStatus || "In Progress"}
            </span>
          </div>

          {!isCompleted && !isRejected && verifyLink && (
            <Button
              onClick={handleOpenRegTank}
              className="w-full"
              variant="outline"
            >
              Open RegTank Portal
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1"
              variant="default"
            >
              <ArrowPathIcon
                className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh Status"}
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
