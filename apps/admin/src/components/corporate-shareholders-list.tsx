"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { BuildingOffice2Icon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface CorporateShareholder {
  [key: string]: unknown;
  // Corporate shareholders structure from RegTank
  // This will be populated from corporate_entities.corporateShareholders
}

interface CorporateShareholdersListProps {
  corporateShareholders: CorporateShareholder[];
}

export function CorporateShareholdersList({
  corporateShareholders,
}: CorporateShareholdersListProps) {
  if (!corporateShareholders || corporateShareholders.length === 0) {
    return null;
  }

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
    // Extract available fields from the corporate shareholder object
    const name = (shareholder as any).name || (shareholder as any).businessName || "Unknown Company";
    const email = (shareholder as any).email || (shareholder as any).contactEmail || null;
    const sharePercentage = (shareholder as any).sharePercentage || (shareholder as any).share_percentage || (shareholder as any).percentage || null;
    const status = (shareholder as any).status || (shareholder as any).corporateOnboardingRequest?.status || null;
    const kybId = (shareholder as any).kybId || (shareholder as any).corporateOnboardingRequest?.kybId || null;
    const codRequestId = (shareholder as any).corporateOnboardingRequest?.requestId || (shareholder as any).requestId || null;
    
    // Build role string with share percentage
    const role = sharePercentage ? `Shareholder (${sharePercentage}%)` : "Shareholder";

    return (
      <div
        key={codRequestId || index}
        className="flex items-center justify-between p-3 rounded-lg border bg-card"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <BuildingOffice2Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{name}</span>
            {getStatusBadge(status)}
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
