import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import type { OrganizationResponse } from "@cashsouk/types";
import {
  UserIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  EyeIcon,
  StarIcon,
  XCircleIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface OrganizationsTableRowProps {
  organization: OrganizationResponse;
  showSophisticated?: boolean;
  onViewDetails?: (organization: OrganizationResponse) => void;
}

export function OrganizationsTableRow({
  organization,
  showSophisticated = false,
  onViewDetails,
}: OrganizationsTableRowProps) {
  const displayName =
    organization.type === "COMPANY"
      ? organization.name || "Unnamed Company"
      : `${organization.owner.firstName} ${organization.owner.lastName}`;

  return (
    <TableRow className="odd:bg-muted/40 hover:bg-muted">
      {/* Organization */}
      <TableCell className="text-sm min-w-[180px] max-w-[280px]">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
              organization.type === "COMPANY" ? "bg-accent/10" : "bg-muted"
            )}
          >
            {organization.type === "COMPANY" ? (
              <BuildingOffice2Icon className="h-4 w-4 text-accent" />
            ) : (
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate" title={displayName}>{displayName}</div>
            {organization.registrationNumber && (
              <div className="text-xs text-muted-foreground truncate" title={`SSM: ${organization.registrationNumber}`}>
                SSM: {organization.registrationNumber}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Type */}
      <TableCell>
        {organization.type === "COMPANY" ? (
          <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10">
            <BuildingOffice2Icon className="h-3 w-3 mr-1 text-blue-600" />
            Company
          </Badge>
        ) : (
          <Badge variant="outline" className="border-slate-500/30 text-foreground bg-slate-500/10">
            <UserIcon className="h-3 w-3 mr-1 text-slate-600" />
            Personal
          </Badge>
        )}
      </TableCell>

      {/* Onboarding Status */}
      <TableCell>
        {organization.onboardingStatus === "COMPLETED" ? (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            Completed
          </Badge>
        ) : organization.onboardingStatus === "REJECTED" ? (
          <Badge variant="outline" className="border-red-500/30 text-foreground bg-red-500/10">
            <XCircleIcon className="h-3 w-3 mr-1 text-red-600" />
            Rejected
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/30 text-foreground bg-amber-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-amber-600" />
            {organization.onboardingStatus === "PENDING" && "Not Started"}
            {organization.onboardingStatus === "IN_PROGRESS" && "In Progress"}
            {organization.onboardingStatus === "PENDING_APPROVAL" && "Pending Approval"}
            {organization.onboardingStatus === "PENDING_AML" && "Pending AML"}
            {organization.onboardingStatus === "PENDING_SSM_REVIEW" && "Pending SSM"}
            {organization.onboardingStatus === "PENDING_FINAL_APPROVAL" && "Pending Final"}
          </Badge>
        )}
      </TableCell>

      {/* Risk Score */}
      <TableCell>
        {organization.riskScore ? (
          <Badge
            variant="outline"
            className={cn(
              "text-foreground",
              organization.riskLevel?.toLowerCase().includes("low")
                ? "border-green-500/30 bg-green-500/10"
                : organization.riskLevel?.toLowerCase().includes("high")
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
            )}
          >
            {organization.riskScore}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      {/* Sophisticated Investor Status (only for investor portal) */}
      {showSophisticated && (
        <>
        <TableCell>
          {organization.isSophisticatedInvestor ? (
            <Badge
              variant="outline"
              className="border-violet-500/30 text-foreground bg-violet-500/10"
            >
              <StarIcon className="h-3 w-3 mr-1 text-violet-600" />
              Yes
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No</span>
          )}
        </TableCell>
          {/* Deposit Received Status (only for investor portal) */}
          <TableCell>
            {organization.depositReceived ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-foreground bg-emerald-500/10"
              >
                <BanknotesIcon className="h-3 w-3 mr-1 text-emerald-600" />
                Received
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">Pending</span>
            )}
          </TableCell>
        </>
      )}

      {/* Members */}
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <UsersIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{organization.memberCount}</span>
        </div>
      </TableCell>

      {/* Created */}
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(organization.createdAt), "dd MMM yyyy")}
      </TableCell>

      {/* Updated */}
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(organization.updatedAt), { addSuffix: true })}
      </TableCell>

      {/* Actions */}
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails?.(organization)}
          className="h-8 px-2"
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
