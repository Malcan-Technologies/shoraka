import * as React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import type { AdminInvestmentItem } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { EyeIcon } from "@heroicons/react/24/outline";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";

interface InvestmentsTableRowProps {
  investment: AdminInvestmentItem;
  onViewNote: (investment: AdminInvestmentItem) => void;
}

function formatDate(value: string | null) {
  return value ? format(new Date(value), "dd MMM yyyy") : "—";
}

const INVESTMENT_STATUS_LABEL: Record<string, string> = {
  COMMITTED: "Committed",
  CONFIRMED: "Confirmed",
  SETTLED: "Settled",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

function InvestmentStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      label={INVESTMENT_STATUS_LABEL[status] ?? status}
      status={getAdminStatusToken(status)}
      className="max-w-full truncate"
    />
  );
}

export function InvestmentsTableRow({ investment, onViewNote }: InvestmentsTableRowProps) {
  const investorName =
    investment.investorOrganizationName ??
    investment.investorUserName ??
    investment.investorUserEmail ??
    investment.investorUserId;

  return (
    <TableRow className={adminActionRowClass(getAdminStatusToken(investment.status))}>
      <TableCell className="min-w-0 overflow-hidden truncate font-mono text-xs" title={investment.noteReference ?? ""}>
        {investment.noteReference ?? "—"}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate font-medium" title={investment.noteTitle ?? ""}>
          {investment.noteTitle ?? "—"}
        </div>
        <div
          className="truncate text-xs text-muted-foreground"
          title={investment.issuerOrganizationName ?? "Unknown issuer"}
        >
          {investment.issuerOrganizationName ?? "Unknown issuer"}
        </div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate font-medium" title={investorName ?? ""}>
          {investorName ?? "—"}
        </div>
        {investment.investorUserName && investment.investorOrganizationName ? (
          <div
            className="truncate text-xs text-muted-foreground"
            title={investment.investorUserName}
          >
            {investment.investorUserName}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate tabular-nums">
        {formatCurrency(investment.amount)}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate tabular-nums text-right">
        {investment.allocationPercent.toFixed(2)}%
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <InvestmentStatusBadge status={investment.status} />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="text-sm">{formatDate(investment.committedAt)}</div>
        {investment.confirmedAt ? (
          <div className="truncate text-xs text-muted-foreground">
            Confirmed {formatDate(investment.confirmedAt)}
          </div>
        ) : investment.releasedAt ? (
          <div className="truncate text-xs text-muted-foreground">
            Released {formatDate(investment.releasedAt)}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewNote(investment)}
          className="gap-1.5"
        >
          <EyeIcon className="h-4 w-4" />
          View note
        </Button>
      </TableCell>
    </TableRow>
  );
}
