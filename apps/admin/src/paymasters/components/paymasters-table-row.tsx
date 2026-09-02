"use client";

import { format } from "date-fns";
import { BuildingOffice2Icon, EyeIcon } from "@heroicons/react/24/outline";
import { isPaymasterVerified, type PaymasterListItem } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import {
  paymasterFinancingBreakdown,
  paymasterIdentityMeta,
  paymasterLinkedFinancingCount,
  paymasterVerificationLabel,
} from "@/paymasters/utils/paymasters-table-presentation";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy");
}

export function PaymastersTableRow({
  item,
  onViewDetails,
}: {
  item: PaymasterListItem;
  onViewDetails: (item: PaymasterListItem) => void;
}) {
  const verified = isPaymasterVerified(item.verificationStatus);
  const statusToken = getAdminStatusToken(item.verificationStatus);
  const identityMeta = paymasterIdentityMeta(item);
  const financingCount = paymasterLinkedFinancingCount(item);

  return (
    <TableRow
      className={cn(
        "cursor-pointer odd:bg-muted/40 hover:bg-muted",
        adminActionRowClass(statusToken)
      )}
      onClick={() => onViewDetails(item)}
    >
      <TableCell className="min-w-[180px] max-w-[320px]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <BuildingOffice2Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium" title={item.legalName}>
              {item.legalName}
            </div>
            {identityMeta ? (
              <div className="truncate font-mono text-xs text-muted-foreground" title={identityMeta}>
                {identityMeta}
              </div>
            ) : null}
            {item.entityType ? (
              <StatusBadge
                label={item.entityType}
                status="submitted"
                showDot={false}
                className="mt-1 max-w-full truncate"
              />
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-ui font-medium tabular-nums">{item.linkedIssuerCount}</div>
        {item.latestIssuerName ? (
          <div className="truncate text-xs text-muted-foreground" title={item.latestIssuerName}>
            {item.latestIssuerName}
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <div className="text-ui font-medium tabular-nums">{financingCount}</div>
        <div className="truncate text-xs text-muted-foreground" title={paymasterFinancingBreakdown(item)}>
          {paymasterFinancingBreakdown(item)}
        </div>
      </TableCell>
      <TableCell className="text-ui font-medium tabular-nums">{item.noticeCount}</TableCell>
      <TableCell className="text-ui text-muted-foreground">
        <div>{formatDate(item.lastUsedAt)}</div>
        <div className="truncate text-xs">Created {formatDate(item.createdAt)}</div>
      </TableCell>
      <TableCell>
        <StatusBadge label={paymasterVerificationLabel(item)} status={statusToken} />
        {verified ? (
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {item.verifiedAt ? formatDate(item.verifiedAt) : "Verified"}
          </div>
        ) : (
          <div className="mt-1 truncate text-xs text-muted-foreground">Needs verification</div>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={(event) => {
            event.stopPropagation();
            onViewDetails(item);
          }}
        >
          <EyeIcon className="mr-1 h-4 w-4" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
