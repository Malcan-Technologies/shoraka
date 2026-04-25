"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  getDisplayKycStatus,
  shouldIncludePerson,
  type DirectorKycStatus,
} from "@cashsouk/types";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface DirectorKycListProps {
  directors: DirectorKycStatus[];
  isRefreshing?: boolean;
}

export function DirectorKycList({ directors, isRefreshing }: DirectorKycListProps) {
  const parseSharePct = (role: string): number => {
    const m = role.match(/\(\s*([\d.]+)\s*%\s*\)/);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : 0;
  };

  const directorKeywords = [
    "director",
    "managing",
    "ceo",
    "coo",
    "cto",
    "cmo",
    "cfo",
    "president",
    "vice president",
    "controller",
    "authorised personnel",
  ];

  const personFlags = (person: DirectorKycStatus) => {
    const role = String(person.role ?? "");
    const roleLower = role.toLowerCase();
    const isDirector = directorKeywords.some((keyword) => roleLower.includes(keyword));
    const isShareholder = roleLower.includes("shareholder");
    const sharePercentage = parseSharePct(role);
    return { isDirector, isShareholder, sharePercentage };
  };

  const getStatusBadge = (status: DirectorKycStatus["kycStatus"]) => {
    const displayStatus = getDisplayKycStatus({
      requestId: "has-request",
      rawStatus: status,
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
          <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
            <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
            KYC Pending
          </Badge>
        );
    }
  };
  const directorsList = directors.filter((person) => {
    const flags = personFlags(person);
    return shouldIncludePerson({ type: "INDIVIDUAL", ...flags }) && flags.isDirector;
  });
  const shareholdersList = directors.filter((person) => {
    const flags = personFlags(person);
    return shouldIncludePerson({ type: "INDIVIDUAL", ...flags }) && !flags.isDirector && flags.isShareholder;
  });

  const renderPersonCard = (person: DirectorKycStatus) => (
    <div
      key={person.eodRequestId}
      className="flex items-center justify-between p-3 rounded-lg border bg-card"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{person.name}</span>
          {getStatusBadge(person.kycStatus)}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <span className="font-medium">Email:</span> {person.email}
          </div>
          <div>
            <span className="font-medium">Role:</span> {person.role}
          </div>
          {person.governmentIdNumber && (
            <div>
              <span className="font-medium">IC:</span> {person.governmentIdNumber}
            </div>
          )}
          {person.kycId && (
            <div>
              <span className="font-medium">KYC ID:</span> {person.kycId}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (directors.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No directors/shareholders requiring KYC verification.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Directors / Controllers / Authorised Personnel Section */}
      {directorsList.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Directors / Controllers / Authorised Personnel
          </h5>
          {directorsList.map(renderPersonCard)}
        </div>
      )}

      {/* Individual Shareholders / Ultimate Beneficiaries Section */}
      {shareholdersList.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Individual Shareholders / Ultimate Beneficiaries
          </h5>
          {shareholdersList.map(renderPersonCard)}
        </div>
      )}

      {isRefreshing && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Refreshing director statuses...
        </div>
      )}
    </div>
  );
}
