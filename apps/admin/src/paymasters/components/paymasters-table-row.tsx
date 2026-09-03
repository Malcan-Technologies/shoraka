"use client";

import { format } from "date-fns";
import { EyeIcon } from "@heroicons/react/24/outline";
import { type PaymasterListItem } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { paymasterVerificationLabel } from "@/paymasters/utils/paymasters-table-presentation";

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
  const statusToken = getAdminStatusToken(item.verificationStatus);

  return (
    <TableRow
      className={cn(
        "cursor-pointer odd:bg-muted/40 hover:bg-muted",
        adminActionRowClass(statusToken)
      )}
      onClick={() => onViewDetails(item)}
    >
      <TableCell className="text-ui font-medium">
        <span className="block max-w-[220px] truncate" title={item.legalName}>
          {item.legalName}
        </span>
      </TableCell>
      <TableCell className="font-mono text-ui" title={item.registrationNumber}>
        {item.registrationNumber || "—"}
      </TableCell>
      <TableCell className="text-ui">{item.registrationCountry || "—"}</TableCell>
      <TableCell>
        {item.entityType ? (
          <StatusBadge label={item.entityType} status="submitted" showDot={false} />
        ) : (
          <span className="text-ui text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-ui tabular-nums" title={item.latestIssuerName ?? undefined}>
        {item.linkedIssuerCount}
      </TableCell>
      <TableCell className="text-ui tabular-nums">{item.linkedFacilityCount}</TableCell>
      <TableCell className="text-ui tabular-nums">{item.linkedNoteCount}</TableCell>
      <TableCell className="text-ui tabular-nums">{item.noticeCount}</TableCell>
      <TableCell className="text-ui text-muted-foreground">{formatDate(item.lastUsedAt)}</TableCell>
      <TableCell>
        <StatusBadge label={paymasterVerificationLabel(item)} status={statusToken} />
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
