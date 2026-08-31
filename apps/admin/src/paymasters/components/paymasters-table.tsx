"use client";

import * as React from "react";
import { format } from "date-fns";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import type { PaymasterListItem } from "@cashsouk/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { ADMIN_ACTION_ROW_CLASS, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 9 }).map((_, cell) => (
            <TableCell key={cell}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function PaymastersTable({
  items,
  loading,
  currentPage,
  pageSize,
  total,
  onPageChange,
  onViewDetails,
}: {
  items: PaymasterListItem[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onViewDetails: (item: PaymasterListItem) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, total);
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-sm font-semibold">Paymaster</TableHead>
              <TableHead className="text-sm font-semibold">SSM / Registration</TableHead>
              <TableHead className="text-sm font-semibold">Country</TableHead>
              <TableHead className="text-sm font-semibold">Entity type</TableHead>
              <TableHead className="text-sm font-semibold">Issuers</TableHead>
              <TableHead className="text-sm font-semibold">Notes</TableHead>
              <TableHead className="text-sm font-semibold">Last used</TableHead>
              <TableHead className="text-sm font-semibold">Verification</TableHead>
              <TableHead className="text-sm font-semibold">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-ui text-muted-foreground">
                  No paymasters yet. They are created when issuers save Customer Details.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn("cursor-pointer", item.mismatchPending && ADMIN_ACTION_ROW_CLASS)}
                  onClick={() => onViewDetails(item)}
                >
                  <TableCell className="text-ui font-medium">{item.legalName}</TableCell>
                  <TableCell className="font-mono text-ui">{item.registrationNumber}</TableCell>
                  <TableCell className="text-ui">{item.registrationCountry}</TableCell>
                  <TableCell className="text-ui">{item.entityType || "—"}</TableCell>
                  <TableCell className="text-ui tabular-nums">{item.linkedIssuerCount}</TableCell>
                  <TableCell className="text-ui tabular-nums">{item.linkedNoteCount}</TableCell>
                  <TableCell className="text-ui text-muted-foreground">
                    {item.lastUsedAt ? format(new Date(item.lastUsedAt), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={item.verificationStatus === "VERIFIED" ? "Verified" : "Unverified"}
                      status={getAdminStatusToken(item.verificationStatus)}
                    />
                  </TableCell>
                  <TableCell>
                    {item.mismatchPending ? (
                      <StatusBadge label="Review required" status="action" />
                    ) : (
                      <span className="text-ui text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={total}
        onPageChange={onPageChange}
      />
    </div>
  );
}
