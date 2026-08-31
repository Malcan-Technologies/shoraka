"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListToolbar, StatusBadge, type FilterChip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { LegalExternalAcceptanceDetailSheet } from "@/components/legal-external-acceptance-detail-sheet";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { adminActionRowClass } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import {
  LEGAL_EXTERNAL_ACCEPTANCE_STATUS_OPTIONS,
  legalAcceptanceEventLabel,
  legalAcceptanceStatusLabel,
  legalAcceptanceStatusToken,
} from "@/lib/legal-acceptance-display";
import {
  useExportLegalExternalAcceptances,
  useLegalExternalAcceptances,
  type LegalExternalAcceptancesParams,
} from "@/hooks/use-legal-external-acceptances";
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalDocumentType,
  type LegalExternalAcceptanceListItem,
  type LegalExternalAcceptanceStatus,
} from "@cashsouk/types";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { AuditEventBadge } from "@/components/audit/audit-event-badge";
import { AuditLogActorCell } from "@/components/audit/audit-log-actor-cell";
import {
  AuditLogDateFields,
  AuditLogFilterOption,
  AuditLogFilterSection,
  AuditLogFilters,
} from "@/components/audit/audit-log-filters";
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
  AuditLogViewDetailsButton,
  auditExportButtonClassName,
  auditRecordCountLabel,
} from "@/components/audit/audit-log-shell";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";

const COLUMN_COUNT = 11;

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

export function LegalExternalAcceptancesPanel() {
  const queryClient = useQueryClient();
  const exportAcceptances = useExportLegalExternalAcceptances();

  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [selectedAcceptanceId, setSelectedAcceptanceId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const apiParams = React.useMemo((): LegalExternalAcceptancesParams => {
    const params: LegalExternalAcceptancesParams = {
      page,
      pageSize: AUDIT_LOG_PAGE_SIZE,
      sortBy: "accepted_at",
      sortOrder: "desc",
    };

    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (documentTypeFilter !== "all") {
      params.documentType = documentTypeFilter as LegalDocumentType;
    }
    if (statusFilter !== "all") {
      params.status = statusFilter as LegalExternalAcceptanceStatus;
    }
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    return params;
  }, [page, searchQuery, documentTypeFilter, statusFilter, dateFrom, dateTo]);

  const { data, isLoading, error } = useLegalExternalAcceptances(apiParams);

  const acceptances = data?.acceptances ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    documentTypeFilter !== "all" ||
    statusFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const appliedFilters: FilterChip[] = [];
  if (documentTypeFilter !== "all") {
    appliedFilters.push({
      id: "type",
      label: `Type: ${LEGAL_DOCUMENT_TYPE_LABELS[documentTypeFilter as LegalDocumentType] ?? documentTypeFilter}`,
      onRemove: () => setDocumentTypeFilter("all"),
    });
  }
  if (statusFilter !== "all") {
    appliedFilters.push({
      id: "status",
      label: `Status: ${legalAcceptanceStatusLabel(statusFilter as LegalExternalAcceptanceStatus)}`,
      onRemove: () => setStatusFilter("all"),
    });
  }
  if (dateFrom) {
    appliedFilters.push({
      id: "date-from",
      label: `From: ${dateFrom}`,
      onRemove: () => setDateFrom(""),
    });
  }
  if (dateTo) {
    appliedFilters.push({
      id: "date-to",
      label: `To: ${dateTo}`,
      onRemove: () => setDateTo(""),
    });
  }

  const clearFilters = () => {
    setSearchQuery("");
    setDocumentTypeFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleReload = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "legal-external-acceptances"] });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { page: _page, pageSize: _pageSize, ...exportParams } = apiParams;
      const blob = await exportAcceptances(exportParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `legal-external-acceptances-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Could not export CSV",
      });
    } finally {
      setExporting(false);
    }
  };

  const openDetails = (row: LegalExternalAcceptanceListItem) => {
    setSelectedAcceptanceId(row.id);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (nextOpen: boolean) => {
    setDetailOpen(nextOpen);
    if (!nextOpen) {
      setSelectedAcceptanceId(null);
    }
  };

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, documentTypeFilter, statusFilter, dateFrom, dateTo]);

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="external acceptances" />;
  }

  return (
    <div className="space-y-6">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by party, email, envelope, or application..."
        appliedFilters={appliedFilters}
        onClearFilters={hasActiveFilters ? clearFilters : undefined}
        onReload={handleReload}
        isLoading={isLoading}
        countLabel={auditRecordCountLabel(totalCount)}
        filterGroups={
          <AuditLogFilters
            activeCount={
              [
                documentTypeFilter !== "all",
                statusFilter !== "all",
                Boolean(dateFrom),
                Boolean(dateTo),
              ].filter(Boolean).length
            }
          >
            <AuditLogFilterSection title="Type">
              <AuditLogFilterOption
                selected={documentTypeFilter === "all"}
                onSelect={() => setDocumentTypeFilter("all")}
              >
                All types
              </AuditLogFilterOption>
              {LEGAL_TYPES.map((type) => (
                <AuditLogFilterOption
                  key={type.value}
                  selected={documentTypeFilter === type.value}
                  onSelect={() => setDocumentTypeFilter(type.value)}
                >
                  {type.label}
                </AuditLogFilterOption>
              ))}
            </AuditLogFilterSection>
            <AuditLogFilterSection title="Status">
              <AuditLogFilterOption
                selected={statusFilter === "all"}
                onSelect={() => setStatusFilter("all")}
              >
                All statuses
              </AuditLogFilterOption>
              {LEGAL_EXTERNAL_ACCEPTANCE_STATUS_OPTIONS.map((option) => (
                <AuditLogFilterOption
                  key={option.value}
                  selected={statusFilter === option.value}
                  onSelect={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </AuditLogFilterOption>
              ))}
            </AuditLogFilterSection>
            <AuditLogFilterSection title="Date">
              <AuditLogDateFields
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              />
            </AuditLogFilterSection>
          </AuditLogFilters>
        }
      >
        <Button
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exporting || totalCount === 0}
          className={auditExportButtonClassName()}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {exporting ? "Exporting..." : "Export"}
        </Button>
      </ListToolbar>

      <AuditLogTableShell
        pagination={
          isLoading
            ? null
            : {
                currentPage: page,
                totalPages,
                pageSize: AUDIT_LOG_PAGE_SIZE,
                totalItems: totalCount,
                onPageChange: setPage,
              }
        }
      >
        <AuditLogTable>
          <AuditLogHeaderRow>
            <AuditLogHead>Timestamp</AuditLogHead>
            <AuditLogHead>Event</AuditLogHead>
            <AuditLogHead>Party</AuditLogHead>
            <AuditLogHead>Role</AuditLogHead>
            <AuditLogHead>Organisation</AuditLogHead>
            <AuditLogHead>Document</AuditLogHead>
            <AuditLogHead>Version</AuditLogHead>
            <AuditLogHead>Application</AuditLogHead>
            <AuditLogHead>Envelope</AuditLogHead>
            <AuditLogHead>Status</AuditLogHead>
            <AuditLogHead align="right">Actions</AuditLogHead>
          </AuditLogHeaderRow>
          <TableBody>
            {isLoading ? (
              <AuditLogSkeletonRows columns={COLUMN_COUNT} />
            ) : acceptances.length === 0 ? (
              <AuditLogEmptyRow colSpan={COLUMN_COUNT} />
            ) : (
              acceptances.map((row) => {
                const timestamp = row.acceptedAt ?? row.createdAt;
                const eventLabel = legalAcceptanceEventLabel(row.status);
                const statusLabel = legalAcceptanceStatusLabel(row.status);
                const token = legalAcceptanceStatusToken(row.status);
                return (
                  <TableRow
                    key={row.id}
                    className={cn(AUDIT_ROW_CLASS, adminActionRowClass(token))}
                    onClick={() => openDetails(row)}
                  >
                    <TableCell className={AUDIT_TIMESTAMP_CELL_CLASS}>
                      {formatAuditDateTime(timestamp)}
                    </TableCell>
                    <TableCell>
                      <AuditEventBadge eventType={row.status} label={eventLabel} />
                    </TableCell>
                    <AuditLogActorCell name={row.partyName} email={row.partyEmail} />
                    <TableCell className="text-ui">{row.partyRole ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] text-ui">
                      <p className="truncate" title={row.organizationName ?? undefined}>
                        {row.organizationName ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-ui">
                      <p className="truncate font-medium" title={row.documentTitle}>
                        {row.documentType
                          ? LEGAL_DOCUMENT_TYPE_LABELS[row.documentType]
                          : row.documentTitle}
                      </p>
                    </TableCell>
                    <TableCell className="text-ui tabular-nums">
                      {row.versionNumber != null ? `v${row.versionNumber}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-meta">{row.applicationId ?? "—"}</TableCell>
                    <TableCell className="font-mono text-meta">{row.envelopeId ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge label={statusLabel} status={token} />
                    </TableCell>
                    <TableCell className="text-right">
                      <AuditLogViewDetailsButton
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetails(row);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </AuditLogTable>
      </AuditLogTableShell>

      <LegalExternalAcceptanceDetailSheet
        acceptanceId={selectedAcceptanceId}
        open={detailOpen && selectedAcceptanceId != null}
        onOpenChange={handleDetailOpenChange}
      />
    </div>
  );
}
