"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { DirectorAmlStatus } from "@cashsouk/types";
import { CheckCircleIcon, ClockIcon, XCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface DirectorAmlListProps {
  directors: DirectorAmlStatus[];
}

export function DirectorAmlList({ directors }: DirectorAmlListProps) {
  const getAmlStatusBadge = (status: DirectorAmlStatus["amlStatus"]) => {
    switch (status) {
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
            <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-yellow-600" />
            Unresolved
          </Badge>
        );
      case "Rejected":
        return (
          <Badge variant="outline" className="border-destructive/30 text-foreground bg-destructive/10">
            <XCircleIcon className="h-3 w-3 mr-1 text-destructive" />
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

  const getMessageStatusBadge = (messageStatus: DirectorAmlStatus["amlMessageStatus"]) => {
    switch (messageStatus) {
      case "DONE":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10 text-xs">
            Done
          </Badge>
        );
      case "ERROR":
        return (
          <Badge variant="outline" className="border-destructive/30 text-foreground bg-destructive/10 text-xs">
            Error
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10 text-xs">
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

  const renderPersonCard = (person: DirectorAmlStatus) => (
    <div
      key={person.kycId}
      className="p-3 rounded-lg border bg-muted/30"
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-medium text-sm">{person.name}</span>
        {getAmlStatusBadge(person.amlStatus)}
        {getMessageStatusBadge(person.amlMessageStatus)}
      </div>
      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        <div className="truncate">
          <span className="font-medium">Email:</span> {person.email}
        </div>
        <div>
          <span className="font-medium">Role:</span> {person.role}
        </div>
        {person.amlRiskScore !== null && (
          <div>
            <span className="font-medium">Risk Score:</span> {person.amlRiskScore}
            {person.amlRiskLevel && ` (${person.amlRiskLevel})`}
          </div>
        )}
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
