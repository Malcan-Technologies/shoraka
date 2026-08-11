import * as React from "react";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@cashsouk/ui";
import { format, formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import type { OrganizationResponse } from "@cashsouk/types";
import { formatOrganizationReference } from "@cashsouk/types";
import {
  UserIcon,
  BuildingOffice2Icon,
  UsersIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
  getOrganizationOnboardingPresentation,
  getOrganizationRiskPresentation,
  getOrganizationTypePresentation,
} from "@/lib/organization-status";

interface OrganizationsTableRowProps {
  organization: OrganizationResponse;
  showSophisticated?: boolean;
  showOnboardingFee?: boolean;
  onViewDetails?: (organization: OrganizationResponse) => void;
}

export function OrganizationsTableRow({
  organization,
  showSophisticated = false,
  showOnboardingFee = false,
  onViewDetails,
}: OrganizationsTableRowProps) {
  const displayName =
    organization.type === "COMPANY"
      ? organization.name || "Unnamed Company"
      : `${organization.owner.firstName} ${organization.owner.lastName}`;
  const ownerName = `${organization.owner.firstName} ${organization.owner.lastName}`.trim();
  const ownerHref = `/users/${encodeURIComponent(organization.owner.userId)}`;
  const typePresentation = getOrganizationTypePresentation(organization.type);
  const onboardingPresentation = getOrganizationOnboardingPresentation(
    organization.onboardingStatus
  );
  const riskStatus = getOrganizationRiskPresentation(organization.riskLevel);

  return (
    <TableRow className="hover:bg-muted/50">
      {/* Organization */}
      <TableCell className="text-sm min-w-[180px] max-w-[280px]">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              organization.type === "COMPANY" ? "bg-primary/10" : "bg-muted"
            )}
          >
            {organization.type === "COMPANY" ? (
              <BuildingOffice2Icon className="h-4 w-4 text-primary" />
            ) : (
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium" title={displayName}>
              {organization.type === "COMPANY" ? (
                displayName
              ) : (
                <Link href={ownerHref} className="hover:text-primary hover:underline">
                  {displayName}
                </Link>
              )}
            </div>
            {organization.registrationNumber && (
              <div
                className="truncate text-xs text-muted-foreground"
                title={`SSM: ${organization.registrationNumber}`}
              >
                SSM: {organization.registrationNumber}
              </div>
            )}
            {organization.displayReference ? (
              <div
                className="truncate text-xs font-mono text-muted-foreground"
                title={organization.displayReference}
              >
                {formatOrganizationReference({
                  displayReference: organization.displayReference,
                  id: organization.id,
                })}
              </div>
            ) : null}
            {organization.type === "COMPANY" && (
              <div
                className="truncate text-xs text-muted-foreground"
                title={organization.owner.email}
              >
                Owner:{" "}
                <Link href={ownerHref} className="hover:text-primary hover:underline">
                  {ownerName || organization.owner.email}
                </Link>
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Type */}
      <TableCell>
        <StatusBadge label={typePresentation.label} status={typePresentation.status} />
      </TableCell>

      {/* Onboarding Status */}
      <TableCell>
        <StatusBadge
          label={onboardingPresentation.label}
          status={onboardingPresentation.status}
        />
      </TableCell>

      {/* Risk Score */}
      <TableCell>
        {organization.riskScore ? (
          <StatusBadge label={String(organization.riskScore)} status={riskStatus} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      {showOnboardingFee && (
        <TableCell>
          {organization.onboardingFeePaid ? (
            <StatusBadge label="Paid" status="success" />
          ) : (
            <span className="text-sm text-muted-foreground">Pending</span>
          )}
        </TableCell>
      )}

      {showSophisticated && (
        <>
          <TableCell>
            {organization.isSophisticatedInvestor ? (
              <StatusBadge label="Yes" status="completed" />
            ) : (
              <span className="text-sm text-muted-foreground">No</span>
            )}
          </TableCell>
          <TableCell>
            {organization.depositReceived ? (
              <StatusBadge label="Received" status="success" />
            ) : (
              <span className="text-sm text-muted-foreground">Pending</span>
            )}
          </TableCell>
          <TableCell className="text-right">
            {organization.walletBalance == null ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              <span className="text-sm font-medium tabular-nums">
                {formatCurrency(organization.walletBalance)}
              </span>
            )}
          </TableCell>
          <TableCell className="text-right">
            {organization.investedAmount == null ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              <span className="text-sm font-medium tabular-nums">
                {formatCurrency(organization.investedAmount)}
              </span>
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
          <EyeIcon className="mr-1 h-4 w-4" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
