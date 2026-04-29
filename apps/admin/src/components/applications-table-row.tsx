import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import type { ApplicationListItem } from "@cashsouk/types";
import {
  BanknotesIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationStatusBadge } from "@/components/application-review";
import {
  applicationTableRowClass,
  applicationTableCellClass,
  applicationTableCellMutedClass,
  applicationTableCellNumericClass,
  applicationTableCellCenterClass,
} from "./application-review/application-table-styles";

interface ApplicationsTableRowProps {
  application: ApplicationListItem;
  onViewDetails?: (application: ApplicationListItem) => void;
}

export function ApplicationsTableRow({
  application,
  onViewDetails,
}: ApplicationsTableRowProps) {
  return (
    <TableRow className={applicationTableRowClass}>
      {/* Reference */}
      <TableCell className={applicationTableCellClass}>
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[100px]" title={application.id}>
            {application.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </TableCell>

      {/* Applicant */}
      <TableCell className={applicationTableCellClass}>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="font-medium truncate max-w-[200px]" title={application.issuerOrganizationName || ""}>
            {application.issuerOrganizationName || "Unnamed Organization"}
          </div>
          {application.directorShareholderAmlPending ? (
            <span className="shrink-0 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-100">
              Pending DS AML
            </span>
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
