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
      <TableCell className="text-[15px] leading-7">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg mt-0.5",
              organization.type === "COMPANY" ? "bg-accent/10" : "bg-muted"
            )}
          >
            {organization.type === "COMPANY" ? (
              <BuildingOffice2Icon className="h-4 w-4 text-accent" />
            ) : (
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="font-medium">{displayName}</div>
            {organization.registrationNumber && (
              <div className="text-xs text-muted-foreground">
                SSM: {organization.registrationNumber}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Type */}
      <TableCell>
        {organization.type === "COMPANY" ? (
          <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-500/10">
            <BuildingOffice2Icon className="h-3 w-3 mr-1" />
            Company
          </Badge>
        ) : (
          <Badge variant="outline" className="border-slate-500/30 text-slate-600 bg-slate-500/10">
            <UserIcon className="h-3 w-3 mr-1" />
            Personal
          </Badge>
        )}
      </TableCell>

      {/* Owner */}
      <TableCell className="text-[15px] leading-7">
        <div>
          <div className="font-medium">
            {organization.owner.firstName} {organization.owner.lastName}
          </div>
          <div className="text-xs text-muted-foreground">{organization.owner.email}</div>
        </div>
      </TableCell>

      {/* Onboarding Status */}
      <TableCell>
        {organization.onboardingStatus === "COMPLETED" ? (
          <Badge variant="outline" className="border-green-500/30 text-green-600 bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        ) : organization.onboardingStatus === "REJECTED" ? (
          <Badge variant="outline" className="border-red-500/30 text-red-600 bg-red-500/10">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10">
            <ClockIcon className="h-3 w-3 mr-1" />
            {organization.onboardingStatus === "PENDING" && "Not Started"}
            {organization.onboardingStatus === "IN_PROGRESS" && "In Progress"}
            {organization.onboardingStatus === "PENDING_APPROVAL" && "Pending Approval"}
            {organization.onboardingStatus === "PENDING_AML" && "Pending AML"}
            {organization.onboardingStatus === "PENDING_SSM_REVIEW" && "Pending SSM"}
            {organization.onboardingStatus === "PENDING_FINAL_APPROVAL" && "Pending Final"}
          </Badge>
        )}
      </TableCell>

      {/* Sophisticated Investor Status (only for investor portal) */}
      {showSophisticated && (
        <>
          <TableCell>
            {organization.isSophisticatedInvestor ? (
              <Badge
                variant="outline"
                className="border-violet-500/30 text-violet-600 bg-violet-500/10"
              >
                <StarIcon className="h-3 w-3 mr-1" />
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
                className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
              >
                <BanknotesIcon className="h-3 w-3 mr-1" />
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
      <TableCell className="text-[15px] leading-7 text-muted-foreground">
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
