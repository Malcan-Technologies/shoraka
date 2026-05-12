import * as React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import type { AdminInvestmentItem } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

interface InvestmentsTableRowProps {
  investment: AdminInvestmentItem;
  onViewNote: (investment: AdminInvestmentItem) => void;
}

function formatDate(value: string | null) {
  return value ? format(new Date(value), "dd MMM yyyy") : "—";
}

const investmentStatusConfig: Record<
  string,
  {
    className: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  COMMITTED: {
    className:
      "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
    icon: ClockIcon,
    label: "Committed",
  },
  CONFIRMED: {
    className:
      "border-transparent bg-status-completed-bg text-status-completed-text dark:bg-sky-950/40 dark:text-sky-300",
    icon: CheckCircleIcon,
    label: "Confirmed",
  },
  SETTLED: {
    className:
      "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckBadgeIcon,
    label: "Settled",
  },
  RELEASED: {
    className:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    icon: ArrowUturnLeftIcon,
    label: "Released",
  },
  CANCELLED: {
    className:
      "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
    icon: XCircleIcon,
    label: "Cancelled",
  },
};

function InvestmentStatusBadge({ status }: { status: string }) {
  const config = investmentStatusConfig[status] ?? {
    className:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    icon: ArchiveBoxIcon,
    label: status,
  };
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`max-w-full truncate ${config.className}`}>
      <Icon className="mr-1 h-3.5 w-3.5 shrink-0" />
      {config.label}
    </Badge>
  );
}

export function InvestmentsTableRow({ investment, onViewNote }: InvestmentsTableRowProps) {
  const investorName =
    investment.investorOrganizationName ??
    investment.investorUserName ??
    investment.investorUserEmail ??
    investment.investorUserId;

  return (
    <TableRow>
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
