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

interface ApplicationsTableRowProps {
  application: ApplicationListItem;
  onViewDetails?: (application: ApplicationListItem) => void;
}

export function ApplicationsTableRow({
  application,
  onViewDetails,
}: ApplicationsTableRowProps) {
  return (
    <TableRow className="odd:bg-muted/40 hover:bg-muted">
      {/* Reference */}
      <TableCell className="text-sm font-medium">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[100px]" title={application.id}>
            {application.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </TableCell>

      {/* Applicant */}
      <TableCell className="text-sm">
        <div className="font-medium truncate max-w-[200px]" title={application.issuerOrganizationName || ""}>
          {application.issuerOrganizationName || "Unnamed Organization"}
        </div>
      </TableCell>

      {/* Financing Structure */}
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <BanknotesIcon className="h-4 w-4" />
          {application.financingStructureLabel}
        </div>
      </TableCell>

      {/* Requested Amount */}
      <TableCell className="text-sm font-semibold">
        {formatCurrency(application.requestedAmount)}
      </TableCell>

      {/* Submitted */}
      <TableCell className="text-sm text-muted-foreground">
        {application.submittedAt
          ? format(new Date(application.submittedAt), "dd MMM yyyy")
          : "—"}
      </TableCell>

      {/* Status */}
      <TableCell>
        <ApplicationStatusBadge status={application.status} />
      </TableCell>

      {/* Updated */}
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
      </TableCell>

      {/* Actions */}
      <TableCell>
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
