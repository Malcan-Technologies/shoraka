"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { BuildingOffice2Icon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface CorporateShareholder {
  [key: string]: unknown;
}

interface CorporateShareholdersListProps {
  corporateShareholders: CorporateShareholder[];
  status?: "PENDING_APPROVAL" | "PENDING_AML" | string; // Current onboarding status
}

export function CorporateShareholdersList({
  corporateShareholders,
  status,
}: CorporateShareholdersListProps) {
  if (!corporateShareholders || corporateShareholders.length === 0) {
    return null;
  }

  // Get KYB AML status badge (for PENDING_AML stage)
  const getKybAmlStatusBadge = (kybAmlStatus: any) => {
    if (!kybAmlStatus || !kybAmlStatus.status) {
      return (
        <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
          <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
          Pending
        </Badge>
      );
    }

    const amlStatus = String(kybAmlStatus.status);
    
    switch (amlStatus) {
      case "Approved":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            Approved
          </Badge>
        );
      case "Unresolved":
        return (
          <Badge variant="outline" className="border-yellow-500/30 text-foreground bg-yellow-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-yellow-600" />
            Unresolved
          </Badge>
        );
      case "Rejected":
        return (
          <Badge variant="destructive">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "Pending":
      default:
        return (
          <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
            <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
            Pending
          </Badge>
        );
    }
  };

  // Get KYC/COD status badge (for PENDING_APPROVAL stage)
  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return (
        <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
          <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
          Pending
        </Badge>
      );
    }

    const statusUpper = String(status).toUpperCase();
    
    switch (statusUpper) {
      case "APPROVED":
      case "CHECKED":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            {statusUpper === "CHECKED" ? "Checked" : "Approved"}
          </Badge>
        );
      case "WAIT_FOR_APPROVAL":
      case "PENDING_APPROVAL":
        return (
          <Badge variant="outline" className="border-yellow-500/30 text-foreground bg-yellow-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-yellow-600" />
            Pending Approval
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="destructive">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
            <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
            Pending
          </Badge>
        );
    }
  };

  const renderCorporateShareholderCard = (shareholder: CorporateShareholder, index: number) => {
    const name = (shareholder as any).name || (shareholder as any).businessName || "Unknown Company";
    const sharePercentage = (shareholder as any).sharePercentage || (shareholder as any).share_percentage || (shareholder as any).percentage || null;
    const codStatus = (shareholder as any).status || (shareholder as any).corporateOnboardingRequest?.status || null;
    const kybId = (shareholder as any).kybId || (shareholder as any).corporateOnboardingRequest?.kybId || null;
    const codRequestId = (shareholder as any).corporateOnboardingRequest?.requestId || (shareholder as any).requestId || null;
    const kybAmlStatus = (shareholder as any).kybAmlStatus || null;
    
    const role = sharePercentage ? `Shareholder (${sharePercentage}%)` : "Shareholder";
    const isPendingAml = status === "PENDING_AML";
    const statusBadge = isPendingAml && kybAmlStatus 
      ? getKybAmlStatusBadge(kybAmlStatus)
      : getStatusBadge(codStatus);

    return (
      <div
        key={codRequestId || index}
        className="p-3 rounded-lg border bg-muted/30"
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <BuildingOffice2Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{name}</span>
          {statusBadge}
        </div>
        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Role:</span> {role}
          </div>
          {kybId && (
            <div>
              <span className="font-medium">KYB ID:</span> {kybId}
            </div>
          )}
          {isPendingAml && kybAmlStatus && kybAmlStatus.riskScore !== null && kybAmlStatus.riskScore !== undefined && (
            <div>
              <span className="font-medium">Risk Score:</span> {kybAmlStatus.riskScore}
              {kybAmlStatus.riskLevel && ` (${kybAmlStatus.riskLevel})`}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Business Shareholders / Beneficiaries
      </h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {corporateShareholders.map(renderCorporateShareholderCard)}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Corporate shareholders/beneficiaries associated with your organization.
      </p>
    </div>
  );
}
