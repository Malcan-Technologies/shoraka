"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { DirectorKycStatus } from "@cashsouk/types";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface DirectorKycListProps {
  directors: DirectorKycStatus[];
  isRefreshing?: boolean;
}

export function DirectorKycList({ directors, isRefreshing }: DirectorKycListProps) {
  const getStatusBadge = (status: DirectorKycStatus["kycStatus"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "WAIT_FOR_APPROVAL":
        return (
          <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
            <ClockIcon className="h-3 w-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case "LIVENESS_STARTED":
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            <ClockIcon className="h-3 w-3 mr-1" />
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
          <Badge variant="secondary">
            <ClockIcon className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (directors.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No directors/shareholders requiring KYC verification.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {directors.map((director) => (
        <div
          key={director.eodRequestId}
          className="flex items-center justify-between p-3 rounded-lg border bg-card"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{director.name}</span>
              {getStatusBadge(director.kycStatus)}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">Email:</span> {director.email}
              </div>
              <div>
                <span className="font-medium">Role:</span> {director.role}
              </div>
              {director.kycId && (
                <div>
                  <span className="font-medium">KYC ID:</span> {director.kycId}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      {isRefreshing && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Refreshing director statuses...
        </div>
      )}
    </div>
  );
}
