"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { getDisplayKycStatus } from "@cashsouk/types";
import { BuildingOffice2Icon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface CorporateShareholder {
  [key: string]: unknown;
  // Corporate shareholders structure from RegTank
  // This will be populated from corporate_entities.corporateShareholders
}

interface CorporateShareholdersListProps {
  corporateShareholders: CorporateShareholder[];
  businessShareholdersAml?: Array<{
    codRequestId: string;
    kybId: string;
    businessName: string;
    sharePercentage?: number | null;
    amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
    amlMessageStatus: "DONE" | "PENDING" | "ERROR";
    amlRiskScore: number | null;
    amlRiskLevel: string | null;
    lastUpdated: string;
  }>;
  onboardingStatus?: "PENDING_APPROVAL" | "PENDING_AML" | string;
}

export function CorporateShareholdersList({
  corporateShareholders,
  businessShareholdersAml,
  onboardingStatus,
}: CorporateShareholdersListProps) {
  if (!corporateShareholders || corporateShareholders.length === 0) {
    return null;
  }

  // Get KYB AML status badge (for PENDING_AML stage)
  const getKybAmlStatusBadge = (amlStatusObj: { amlStatus: string } | null | undefined) => {
    if (!amlStatusObj || !amlStatusObj.amlStatus) {
      return (
        <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
          <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
          Pending
        </Badge>
      );
    }

    const amlStatus = String(amlStatusObj.amlStatus);
    
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

  // Use shared KYC display mapping for COD/KYB status.
  const getStatusBadge = (status: string | null | undefined) => {
    const statusUpper = String(status).toUpperCase();
    const normalizedRawStatus = statusUpper === "CHECKED" ? "APPROVED" : statusUpper;
    const displayStatus = getDisplayKycStatus({
      requestId: "has-request",
      rawStatus: normalizedRawStatus,
    });

    switch (displayStatus) {
      case "KYC Approved":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            KYC Approved
          </Badge>
        );
      case "KYC Failed":
        return (
          <Badge variant="destructive">
            <XCircleIcon className="h-3 w-3 mr-1" />
            KYC Failed
          </Badge>
        );
      case "Not Started":
        return (
          <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
            <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
            Not Started
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-yellow-500/30 text-foreground bg-yellow-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-yellow-600" />
            KYC Pending
          </Badge>
        );
    }
  };

  const renderCorporateShareholderCard = (shareholder: CorporateShareholder, index: number) => {
    const name = (shareholder as any).name || (shareholder as any).businessName || "Unknown Company";
    const email = (shareholder as any).email || (shareholder as any).contactEmail || null;
    const sharePercentage = (shareholder as any).sharePercentage || (shareholder as any).share_percentage || (shareholder as any).percentage || null;
    const codStatus = (shareholder as any).status || (shareholder as any).corporateOnboardingRequest?.status || null;
    const codRequestId = (shareholder as any).corporateOnboardingRequest?.requestId || (shareholder as any).requestId || null;
    
    // Find matching AML status from directorAmlStatus.businessShareholders[]
    const matchingAmlStatus = businessShareholdersAml?.find(
      (b) => b.codRequestId === codRequestId || 
             (shareholder as any).kybId && b.kybId === (shareholder as any).kybId
    );
    
    const kybId = matchingAmlStatus?.kybId || (shareholder as any).kybId || null;
    const finalSharePercentage = matchingAmlStatus?.sharePercentage || sharePercentage;
    
    const role = finalSharePercentage ? `Shareholder (${finalSharePercentage}%)` : "Shareholder";
    const isPendingAml = onboardingStatus === "PENDING_AML";
    const statusBadge = isPendingAml && matchingAmlStatus
      ? getKybAmlStatusBadge(matchingAmlStatus)
      : getStatusBadge(codStatus);

    return (
      <div
        key={codRequestId || index}
        className="flex items-center justify-between p-3 rounded-lg border bg-card"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <BuildingOffice2Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{name}</span>
            {statusBadge}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            {email && (
              <div>
                <span className="font-medium">Email:</span> {email}
              </div>
            )}
            <div>
              <span className="font-medium">Role:</span> {role}
            </div>
            {isPendingAml && matchingAmlStatus ? (
              <>
                {kybId && (
                  <div>
                    <span className="font-medium">KYB ID:</span> {kybId}
                  </div>
                )}
                {matchingAmlStatus.amlRiskScore !== null && matchingAmlStatus.amlRiskScore !== undefined && (
                  <div>
                    <span className="font-medium">Risk Score:</span> {matchingAmlStatus.amlRiskScore}
                  </div>
                )}
                {matchingAmlStatus.amlRiskLevel && (
                  <div>
                    <span className="font-medium">Risk Level:</span> {matchingAmlStatus.amlRiskLevel}
                  </div>
                )}
              </>
            ) : (
              <>
                {kybId && (
                  <div>
                    <span className="font-medium">KYB ID:</span> {kybId}
                  </div>
                )}
                {codRequestId && !kybId && (
                  <div>
                    <span className="font-medium">COD:</span> {codRequestId}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Business Shareholders / Beneficiaries
      </h5>
      {corporateShareholders.map(renderCorporateShareholderCard)}
    </div>
  );
}
