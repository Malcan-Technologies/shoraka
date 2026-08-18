import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import type { ApplicationListItem } from "@cashsouk/types";
import { formatApplicationReference } from "@cashsouk/types";
import {
  BanknotesIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationStatusBadge } from "@/components/application-review";
import { StatusBadge } from "@cashsouk/ui";
import {
  applicationTableRowClass,
  applicationTableCellClass,
  applicationTableCellMutedClass,
  applicationTableCellNumericClass,
  applicationTableCellCenterClass,
} from "./application-review/application-table-styles";
import {
  ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL,
  ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT,
} from "@/lib/admin-director-shareholder-review-message";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

interface ApplicationsTableRowProps {
  application: ApplicationListItem;
  onViewDetails?: (application: ApplicationListItem) => void;
}

export function ApplicationsTableRow({
  application,
  onViewDetails,
}: ApplicationsTableRowProps) {
  const hasPending = Boolean(application.directorShareholderAmlPending);
  const needsAdminAction =
    hasPending || getAdminStatusToken(application.status) === "action";

  return (
    <TableRow className={cn(applicationTableRowClass, adminActionRowClass(needsAdminAction))}>
      {/* Reference */}
      <TableCell className={`${applicationTableCellClass} min-w-0 overflow-hidden truncate font-mono text-xs`}>
        <div className="min-w-0">
          <span className="block truncate" title={application.displayReference ?? application.id}>
            {formatApplicationReference({
              displayReference: application.displayReference,
              id: application.id,
            })}
          </span>
        </div>
      </TableCell>

      {/* Applicant */}
      <TableCell className={applicationTableCellClass}>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="font-medium truncate max-w-[200px]" title={application.issuerOrganizationName || ""}>
            {application.issuerOrganizationName || "Unnamed Organization"}
          </div>
          {hasPending ? (
            <StatusBadge
              label={ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL}
              status="action"
              title={ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT}
            />
          ) : null}
        </div>
      </TableCell>

      {/* Financing Structure */}
      <TableCell className={applicationTableCellClass}>
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <BanknotesIcon className="h-4 w-4" />
          {application.financingStructureLabel}
        </div>
      </TableCell>

      {/* Requested Amount */}
      <TableCell className={applicationTableCellNumericClass}>
        {formatCurrency(application.requestedAmount)}
      </TableCell>

      {/* Submitted */}
      <TableCell className={applicationTableCellMutedClass}>
        {application.submittedAt
          ? format(new Date(application.submittedAt), "dd MMM yyyy")
          : "—"}
      </TableCell>

      {/* Status */}
      <TableCell className={applicationTableCellClass}>
        <ApplicationStatusBadge status={application.status} />
      </TableCell>

      {/* Updated */}
      <TableCell className={applicationTableCellMutedClass}>
        {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
      </TableCell>

      {/* Actions */}
      <TableCell className={applicationTableCellCenterClass}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails?.(application)}
          className="h-8 px-2"
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
