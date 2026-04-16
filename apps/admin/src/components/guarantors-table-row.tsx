import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import type { GuarantorListItem } from "@cashsouk/types";
import {
  UserIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EyeIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface GuarantorsTableRowProps {
  guarantor: GuarantorListItem;
  onViewDetails?: (guarantor: GuarantorListItem) => void;
}

/** RegTank-style onboarding status strings → same badge patterns as organization onboarding column */
function GuarantorOnboardingBadge({ status }: { status: string | null }) {
  const raw = status?.trim();
  if (!raw) {
    return (
      <Badge variant="outline" className="border-amber-500/30 text-foreground bg-amber-500/10">
        <ClockIcon className="h-3 w-3 mr-1 text-amber-600" />
        Not started
      </Badge>
    );
  }

  const upper = raw.toUpperCase();
  if (upper === "APPROVED" || upper === "COMPLETED") {
    return (
      <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
        <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
        Completed
      </Badge>
    );
  }

  if (upper === "REJECTED" || upper === "EXPIRED") {
    return (
      <Badge variant="outline" className="border-red-500/30 text-foreground bg-red-500/10">
        <XCircleIcon className="h-3 w-3 mr-1 text-red-600" />
        {upper === "EXPIRED" ? "Expired" : "Rejected"}
      </Badge>
    );
  }

  const label = raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");

  return (
    <Badge variant="outline" className="border-amber-500/30 text-foreground bg-amber-500/10">
      <ClockIcon className="h-3 w-3 mr-1 text-amber-600" />
      {label}
    </Badge>
  );
}

export function GuarantorsTableRow({ guarantor, onViewDetails }: GuarantorsTableRowProps) {
  const isCompany = guarantor.guarantorType === "company";
  const identifierLine = isCompany
    ? `SSM: ${guarantor.ssmNumber?.trim() || "—"}`
    : `IC: ${guarantor.icNumber?.trim() || "—"}`;

  return (
    <TableRow className="odd:bg-muted/40 hover:bg-muted">
      <TableCell className="text-sm min-w-[220px] max-w-[320px]">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 bg-primary/10">
            {isCompany ? (
              <BuildingOffice2Icon className="h-4 w-4 text-primary" />
            ) : (
              <UserIcon className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate" title={guarantor.displayName}>
              {guarantor.displayName}
            </div>
            <div className="text-xs text-muted-foreground truncate" title={identifierLine}>
              {identifierLine}
            </div>
          </div>
        </div>
      </TableCell>

      <TableCell>
        {isCompany ? (
          <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10">
            <BuildingOffice2Icon className="h-3 w-3 mr-1 text-blue-600" />
            Company
          </Badge>
        ) : (
          <Badge variant="outline" className="border-slate-500/30 text-foreground bg-slate-500/10">
            <UserIcon className="h-3 w-3 mr-1 text-slate-600" />
            Individual
          </Badge>
        )}
      </TableCell>

      <TableCell>
        <GuarantorOnboardingBadge status={guarantor.onboardingStatus} />
      </TableCell>

      <TableCell>
        {guarantor.amlRiskScore !== null && guarantor.amlRiskScore !== undefined ? (
          <Badge
            variant="outline"
            className={cn(
              "text-foreground",
              guarantor.amlRiskLevel?.toLowerCase().includes("low")
                ? "border-green-500/30 bg-green-500/10"
                : guarantor.amlRiskLevel?.toLowerCase().includes("high")
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
            )}
          >
            {guarantor.amlRiskScore}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <LinkIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{guarantor.linkedApplicationsCount}</span>
        </div>
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(guarantor.createdAt), "dd MMM yyyy")}
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(guarantor.updatedAt), { addSuffix: true })}
      </TableCell>

      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails?.(guarantor)}
          className="h-8 px-2"
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
