"use client";

import * as React from "react";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";

interface CorporateShareholder {
  [key: string]: unknown;
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

  const renderCorporateShareholderCard = (shareholder: CorporateShareholder, index: number) => {
    const name = (shareholder as any).name || (shareholder as any).businessName || "Unknown Company";
    const registrationNumber = (shareholder as any).registrationNumber || (shareholder as any).registration_number || null;
    const sharePercentage = (shareholder as any).sharePercentage || (shareholder as any).share_percentage || (shareholder as any).percentage || null;
    const country = (shareholder as any).country || null;
    const status = (shareholder as any).status || null;

    return (
      <div
        key={index}
        className="flex items-center justify-between p-3 rounded-lg border bg-card"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <BuildingOffice2Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{name}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            {registrationNumber && (
              <div>
                <span className="font-medium">Registration Number:</span> {registrationNumber}
              </div>
            )}
            {sharePercentage && (
              <div>
                <span className="font-medium">% of Shares:</span> {sharePercentage}
              </div>
            )}
            {country && (
              <div>
                <span className="font-medium">Country:</span> {country}
              </div>
            )}
            {status && (
              <div>
                <span className="font-medium">Status:</span> {status}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 mt-4">
      <h4 className="text-sm font-medium">Business Shareholders / Beneficiaries</h4>
      <div className="space-y-3">
        {corporateShareholders.map(renderCorporateShareholderCard)}
      </div>
      <p className="text-xs text-muted-foreground">
        Corporate shareholders/beneficiaries associated with your organization.
      </p>
    </div>
  );
}
