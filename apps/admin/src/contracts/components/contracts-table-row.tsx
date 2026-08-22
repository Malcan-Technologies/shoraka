import { TableCell, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import type { ContractListItem } from "@cashsouk/types";
import { formatContractReference } from "@cashsouk/types";
import { BuildingOffice2Icon, DocumentTextIcon, EyeIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Progress } from "@cashsouk/ui";
import { ApplicationStatusBadge } from "@/components/application-review";
import { Button } from "@/components/ui/button";
import {
  getContractUtilizationProgressClass,
  resolveContractFacilityMetrics,
} from "@/contracts/utils/contract-facility-metrics";
import {
  compactRemainingAllocationLine,
  compactReservedLine,
  OVER_LIMIT_LABEL,
} from "@/lib/facility-capacity-display";
import { StatusBadge } from "@cashsouk/ui";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

interface ContractsTableRowProps {
  contract: ContractListItem;
  onViewDetails?: (contract: ContractListItem) => void;
}

function UtilizationCell({ contract }: { contract: ContractListItem }) {
  const metrics = resolveContractFacilityMetrics(contract);
  const hasFacility = metrics.approved > 0;
  const percent = metrics.utilizationPercent ?? 0;
  const barValue = Math.min(Math.max(percent, 0), 100);
  const reservedLine = compactReservedLine(metrics.pending, formatCurrency);
  const allocationLine = compactRemainingAllocationLine(metrics, formatCurrency);

  if (!hasFacility) {
    return (
      <TableCell className="min-w-[10rem]">
        <div className="text-sm text-muted-foreground">—</div>
        <Progress value={0} className={`mt-2 h-2 ${getContractUtilizationProgressClass(0, false)}`} />
        <div className="truncate text-xs text-muted-foreground">No approved facility</div>
        {allocationLine ? (
          <div className="truncate text-meta text-muted-foreground" title={allocationLine}>
            {allocationLine}
          </div>
        ) : null}
      </TableCell>
    );
  }

  return (
    <TableCell className="min-w-[10rem]">
      <div className="flex flex-wrap items-center gap-2">
        <span>{percent.toFixed(1)}%</span>
        {metrics.isOverLimit ? (
          <StatusBadge label={OVER_LIMIT_LABEL} status="rejected" />
        ) : null}
      </div>
      <Progress
        value={barValue}
        className={`mt-2 h-2 ${getContractUtilizationProgressClass(percent, true)}`}
      />
      <div
        className="truncate text-xs text-muted-foreground"
        title={`${formatCurrency(metrics.occupied)} of ${formatCurrency(metrics.approved)} approved`}
      >
        {formatCurrency(metrics.occupied)} of {formatCurrency(metrics.approved)}
      </div>
      {reservedLine ? (
        <div className="truncate text-meta text-muted-foreground">{reservedLine}</div>
      ) : null}
      {allocationLine ? (
        <div className="truncate text-meta text-muted-foreground" title={allocationLine}>
          {allocationLine}
        </div>
      ) : null}
    </TableCell>
  );
}

export function ContractsTableRow({ contract, onViewDetails }: ContractsTableRowProps) {
  return (
    <TableRow
      className={cn(
        "odd:bg-muted/40 hover:bg-muted",
        adminActionRowClass(getAdminStatusToken(contract.status))
      )}
    >
      <TableCell className="min-w-0 overflow-hidden truncate font-mono text-xs">
        <span
          className="block truncate"
          title={contract.displayReference ?? contract.id}
        >
          {formatContractReference({
            displayReference: contract.displayReference,
            id: contract.id,
          })}
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
          {contract.title || "Untitled facility"}
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

      <TableCell className="text-sm font-semibold">
        {contract.approvedFacility > 0 ? formatCurrency(contract.approvedFacility) : "—"}
      </TableCell>

      <UtilizationCell contract={contract} />

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
