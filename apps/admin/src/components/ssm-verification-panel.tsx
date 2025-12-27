"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BuildingOffice2Icon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { OnboardingApplicationResponse } from "@cashsouk/types";

interface SSMVerificationPanelProps {
  application: OnboardingApplicationResponse;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function SSMVerificationPanel({
  application,
  onApprove,
  onReject,
  disabled = false,
}: SSMVerificationPanelProps) {
  const [confirmed, setConfirmed] = React.useState(false);

  // Company info is in the flat structure now
  const hasCompanyInfo = application.type === "COMPANY" && application.organizationName;

  if (!hasCompanyInfo) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <span>Company details not available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isAlreadyVerified = application.ssmVerified;

  return (
    <div className="space-y-6">
      {/* Company Details Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BuildingOffice2Icon className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Verify these details against SSM (Suruhanjaya Syarikat Malaysia) records
              </CardDescription>
            </div>
            {isAlreadyVerified && (
              <Badge className="bg-emerald-600 text-white">
                <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company Name */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-sm font-medium text-muted-foreground">Company Name</div>
            <div className="col-span-2 text-sm font-medium">{application.organizationName}</div>
          </div>

          <Separator />

          {/* Registration Number */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" />
              SSM Registration No.
            </div>
            <div className="col-span-2">
              <Badge variant="outline" className="font-mono text-sm">
                {application.registrationNumber || "Not provided"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Applicant Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-sm font-medium text-muted-foreground">Applicant</div>
            <div className="col-span-2 text-sm">
              {application.userName} ({application.userEmail})
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Already Done */}
      {isAlreadyVerified && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900 dark:text-emerald-100">
                  SSM Verification Completed
                </p>
                {application.ssmVerifiedAt && application.ssmVerifiedBy && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Verified by {application.ssmVerifiedBy} on{" "}
                    {new Date(application.ssmVerifiedAt).toLocaleDateString("en-MY", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Action */}
      {!isAlreadyVerified && (
        <Card className="border-[hsl(29.6_51%_28.8%)]/30 bg-[hsl(29.6_51%_28.8%)]/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">SSM Verification Required</CardTitle>
            <CardDescription>
              You must verify the company details above against SSM records before proceeding to
              RegTank approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Verification Checklist */}
            <div className="space-y-3 text-sm">
              <p className="font-medium">Please verify the following:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  Company name matches SSM records exactly
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  SSM registration number is valid and active
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  Company is in good standing with SSM
                </li>
              </ul>
            </div>

            <Separator />

            {/* Confirmation Toggle */}
            <div className="flex items-center space-x-3">
              <Switch
                id="ssm-confirmed"
                checked={confirmed}
                onCheckedChange={setConfirmed}
                disabled={disabled}
              />
              <Label htmlFor="ssm-confirmed" className="text-sm font-medium cursor-pointer">
                I have verified this company against SSM records
              </Label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={onApprove}
                disabled={!confirmed || disabled}
                className="flex-1"
              >
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Approve SSM Verification
              </Button>
              <Button
                variant="outline"
                onClick={onReject}
                disabled={disabled}
                className="border-destructive text-destructive hover:bg-destructive/10"
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
