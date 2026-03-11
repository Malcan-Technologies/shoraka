import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import type { ContractListItem } from "@cashsouk/types";
import { BuildingOffice2Icon, DocumentTextIcon, EyeIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationStatusBadge } from "@/components/application-review";
import { Button } from "@/components/ui/button";

interface ContractsTableRowProps {
  contract: ContractListItem;
  onViewDetails?: (contract: ContractListItem) => void;
}

export function ContractsTableRow({ contract, onViewDetails }: ContractsTableRowProps) {
  return (
    <TableRow className="odd:bg-muted/40 hover:bg-muted">
      <TableCell className="text-sm font-medium">
        <span className="truncate max-w-[100px]" title={contract.id}>
          {contract.id.slice(-8).toUpperCase()}
        </span>
      </TableCell>

      <TableCell className="text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <DocumentTextIcon className="h-4 w-4" />
          <span className="font-medium text-foreground truncate max-w-[180px]" title={contract.contractNumber || ""}>
            {contract.contractNumber || "—"}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-sm">
        <span className="font-medium text-foreground truncate max-w-[220px] block" title={contract.title || ""}>
          {contract.title || "Untitled Contract"}
        </span>
      </TableCell>

      <TableCell className="text-sm">
        <div className="flex items-center gap-1.5">
          <BuildingOffice2Icon className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-[220px]" title={contract.issuerOrganizationName || ""}>
            {contract.issuerOrganizationName || "Unnamed Organization"}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-sm font-semibold">
        {formatCurrency(contract.contractValue)}
      </TableCell>

      <TableCell>
        <ApplicationStatusBadge status={contract.status} />
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(contract.updatedAt), { addSuffix: true })}
      </TableCell>

      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails?.(contract)}
          className="h-8 px-2"
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
