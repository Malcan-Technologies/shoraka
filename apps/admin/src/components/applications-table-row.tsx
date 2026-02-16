import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import type { ApplicationListItem } from "@cashsouk/types";
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";

interface ApplicationsTableRowProps {
  application: ApplicationListItem;
  onViewDetails?: (application: ApplicationListItem) => void;
}

export function ApplicationsTableRow({
  application,
  onViewDetails,
}: ApplicationsTableRowProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10">
            <ClipboardDocumentCheckIcon className="h-3 w-3 mr-1 text-blue-600" />
            Submitted
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="border-red-500/30 text-foreground bg-red-500/10">
            <XCircleIcon className="h-3 w-3 mr-1 text-red-600" />
            Rejected
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge variant="outline" className="border-slate-500/30 text-foreground bg-slate-500/10">
            <ArchiveBoxIcon className="h-3 w-3 mr-1 text-slate-600" />
            Archived
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge variant="outline" className="border-amber-500/30 text-foreground bg-amber-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-amber-600" />
            Draft
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-amber-500/30 text-foreground bg-amber-500/10">
            <ClockIcon className="h-3 w-3 mr-1 text-amber-600" />
            {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
          </Badge>
        );
    }
  };

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
        {getStatusBadge(application.status)}
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
