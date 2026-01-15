"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { DirectorKycStatus } from "@cashsouk/types";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface DirectorKycListProps {
  directors: DirectorKycStatus[];
}

export function DirectorKycList({ directors }: DirectorKycListProps) {
  const getStatusBadge = (status: DirectorKycStatus["kycStatus"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            Approved
          </Badge>
        );
      case "WAIT_FOR_APPROVAL":
      case "LIVENESS_PASSED":
        return (
          <Badge variant="outline" className="border-yellow-500/30 text-foreground bg-yellow-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-yellow-600" />
            Pending Approval
          </Badge>
        );
      case "LIVENESS_STARTED":
        return (
          <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-blue-600" />
            In Progress
          </Badge>
        );
      case "EMAIL_SENT":
        return (
          <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-blue-600" />
            In Progress
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

  const directorRoles = [
    "Director",
    "Managing",
    "CEO",
    "COO",
    "CTO",
    "CMO",
    "CFO",
    "President",
    "Vice President",
    "Controller",
    "Authorised Personnel",
  ];

  const directorsList = directors.filter((d) =>
    directorRoles.some((role) => d.role.includes(role))
  );
  const shareholdersList = directors.filter((d) => d.role.includes("Shareholder"));

  const renderPersonCard = (person: DirectorKycStatus) => (
    <div
      key={person.eodRequestId}
      className="p-3 rounded-lg border bg-muted/30"
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-medium text-sm">{person.name}</span>
        {getStatusBadge(person.kycStatus)}
      </div>
      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        <div className="truncate">
          <span className="font-medium">Email:</span> {person.email}
        </div>
        <div>
          <span className="font-medium">Role:</span> {person.role}
        </div>
      </div>
    </div>
  );

  if (directors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Directors / Controllers / Authorised Personnel Section */}
      {directorsList.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Directors / Controllers / Authorised Personnel
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {directorsList.map(renderPersonCard)}
          </div>
        </div>
      )}

      {/* Individual Shareholders / Ultimate Beneficiaries Section */}
      {shareholdersList.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Individual Shareholders / Ultimate Beneficiaries
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {shareholdersList.map(renderPersonCard)}
          </div>
        </div>
      )}
    </div>
  );
}
