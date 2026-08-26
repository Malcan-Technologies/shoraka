"use client";

import type { MouseEvent, ReactNode } from "react";
import { EyeIcon } from "@heroicons/react/24/outline";
import { EmptyState, Skeleton, listToolbarControlClassName } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { cn } from "@/lib/utils";

export const AUDIT_TABLE_SHELL_CLASS =
  "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

export const AUDIT_ROW_CLASS = "h-14 cursor-pointer hover:bg-muted/50";

export const AUDIT_TIMESTAMP_CELL_CLASS = "whitespace-nowrap text-ui text-muted-foreground";

export const AUDIT_IP_CELL_CLASS = "font-mono text-ui text-muted-foreground";

export const AUDIT_LOG_PAGE_SIZE = 15;

export function auditRecordCountLabel(count: number): string {
  return `${count} ${count === 1 ? "record" : "records"}`;
}

export function AuditLogTableShell({
  children,
  pagination,
}: {
  children: ReactNode;
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  } | null;
}) {
  const totalItems = pagination?.totalItems ?? 0;
  const currentPage = pagination?.currentPage ?? 1;
  const pageSize = pagination?.pageSize ?? 0;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={AUDIT_TABLE_SHELL_CLASS}>
      {children}
      {pagination && totalItems > 0 ? (
        <TablePagination
          currentPage={currentPage}
          totalPages={Math.max(1, pagination.totalPages)}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalItems}
          onPageChange={pagination.onPageChange}
        />
      ) : null}
    </div>
  );
}

export function AuditLogTable({ children }: { children: ReactNode }) {
  return <Table>{children}</Table>;
}

export function AuditLogHeaderRow({ children }: { children: ReactNode }) {
  return (
    <TableHeader className="bg-muted/30">
      <TableRow className="hover:bg-transparent">{children}</TableRow>
    </TableHeader>
  );
}

export function AuditLogHead({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <TableHead
      className={cn(
        "h-10 text-ui font-medium",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </TableHead>
  );
}

export function AuditLogEmptyRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message?: string;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="flex min-h-[22rem] items-center justify-center px-6">
          <EmptyState
            variant="no-results"
            title="No records found"
            message={message ?? "Try adjusting your search or filters."}
            className="w-full max-w-md border-0 py-0"
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AuditLogSkeletonRows({
  columns,
  rows = 7,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className="h-14 hover:bg-transparent">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-5 w-full max-w-[10rem]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function AuditLogViewDetailsButton({
  onClick,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onClick}>
      <EyeIcon className="mr-1 h-4 w-4" />
      View details
    </Button>
  );
}

export function auditExportButtonClassName() {
  return listToolbarControlClassName;
}
