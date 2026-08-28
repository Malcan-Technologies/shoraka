"use client";

import * as React from "react";
import { ListToolbar } from "@cashsouk/ui";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { useLegalExternalAcceptances } from "@/hooks/use-legal-external-acceptances";
import {
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_ROW_CLASS,
  AUDIT_TIMESTAMP_CELL_CLASS,
  AuditLogEmptyRow,
  AuditLogHead,
  AuditLogHeaderRow,
  AuditLogSkeletonRows,
  AuditLogTable,
  AuditLogTableShell,
} from "@/components/audit/audit-log-shell";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";

const COLUMN_COUNT = 8;

export function LegalExternalAcceptancesPanel() {
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { data, isLoading, error, refetch } = useLegalExternalAcceptances(page, searchQuery);
  const rows = data?.acceptances ?? [];
  const total = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="external acceptances" />;
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(1);
        }}
        searchPlaceholder="Search party, envelope, or application"
        onReload={() => void refetch()}
        isLoading={isLoading}
        countLabel={`${total} ${total === 1 ? "record" : "records"}`}
      />
      <AuditLogTableShell
        pagination={{
          currentPage: page,
          totalPages,
          pageSize: AUDIT_LOG_PAGE_SIZE,
          totalItems: total,
          onPageChange: setPage,
        }}
      >
        <AuditLogTable>
          <AuditLogHeaderRow>
            <AuditLogHead>Accepted</AuditLogHead>
            <AuditLogHead>Party</AuditLogHead>
            <AuditLogHead>Role</AuditLogHead>
            <AuditLogHead>Document</AuditLogHead>
            <AuditLogHead>Organisation</AuditLogHead>
            <AuditLogHead>Application</AuditLogHead>
            <AuditLogHead>Envelope</AuditLogHead>
            <AuditLogHead>Hash</AuditLogHead>
          </AuditLogHeaderRow>
          <TableBody>
            {isLoading ? (
              <AuditLogSkeletonRows columns={COLUMN_COUNT} />
            ) : rows.length === 0 ? (
              <AuditLogEmptyRow colSpan={COLUMN_COUNT} message="No external legal acceptances." />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className={AUDIT_ROW_CLASS}>
                  <TableCell className={AUDIT_TIMESTAMP_CELL_CLASS}>
                    {formatAuditDateTime(row.acceptedAt ?? row.createdAt)}
                  </TableCell>
                  <TableCell className="text-ui">
                    <div>{row.partyName}</div>
                    <div className="text-meta text-muted-foreground">{row.partyEmail}</div>
                  </TableCell>
                  <TableCell className="text-ui">{row.partyRole ?? "—"}</TableCell>
                  <TableCell className="text-ui">
                    {row.documentTitle}
                    {row.versionNumber != null ? ` v${row.versionNumber}` : ""}
                  </TableCell>
                  <TableCell className="text-ui">{row.organizationName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-meta">{row.applicationId ?? "—"}</TableCell>
                  <TableCell className="font-mono text-meta">{row.envelopeId ?? "—"}</TableCell>
                  <TableCell className="font-mono text-meta">{row.documentHash ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </AuditLogTable>
      </AuditLogTableShell>
    </div>
  );
}
