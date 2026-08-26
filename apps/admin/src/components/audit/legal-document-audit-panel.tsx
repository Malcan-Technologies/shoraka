"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListToolbar, type FilterChip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  useExportLegalDocumentAuditLogs,
  useLegalDocumentAuditLogs,
  type LegalDocumentAuditLogsParams,
} from "@/hooks/use-legal-document-audit-logs";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalDocumentAuditLogListItem,
  type LegalDocumentType,
} from "@cashsouk/types";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { AuditEventBadge } from "@/components/audit/audit-event-badge";
import {
  companionInitialVersionUpload,
  legalAuditToAuditDetail,
  visibleLegalDocumentAuditLogs,
} from "@/components/audit/audit-adapters";
import { formatAuditDateTime, formatAuditEventLabel } from "@/components/audit/audit-presentation";
import {
  AuditLogDateFields,
  AuditLogFilterOption,
  AuditLogFilterSection,
  AuditLogFilters,
} from "@/components/audit/audit-log-filters";
import { AuditLogActorCell } from "@/components/audit/audit-log-actor-cell";
import {
  AUDIT_IP_CELL_CLASS,
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

const COLUMN_COUNT = 7;

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

const ACTION_OPTIONS = [
  { value: "LEGAL_DOCUMENT_CREATED", label: "Document created" },
  { value: "LEGAL_DOCUMENT_UPDATED", label: "Document updated" },
  { value: "LEGAL_VERSION_UPLOADED", label: "Version uploaded" },
  { value: "LEGAL_VERSION_FILE_REPLACED", label: "Version file replaced" },
  { value: "LEGAL_VERSION_PUBLISHED", label: "Version published" },
  { value: "LEGAL_VERSION_ARCHIVED", label: "Version archived" },
  { value: "LEGAL_VERSION_RESTORED", label: "Version restored" },
] as const;

function actionLabel(action: string): string {
  return ACTION_OPTIONS.find((option) => option.value === action)?.label ?? formatAuditEventLabel(action);
}

export function LegalDocumentAuditPanel() {
  const queryClient = useQueryClient();
  const exportLogs = useExportLegalDocumentAuditLogs();

  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [documentTypeFilter, setDocumentTypeFilter] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<LegalDocumentAuditLogListItem | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const apiParams = React.useMemo((): LegalDocumentAuditLogsParams => {
    const params: LegalDocumentAuditLogsParams = {
      page,
      pageSize: AUDIT_LOG_PAGE_SIZE,
    };

    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (actionFilter !== "all") {
      params.action = actionFilter as LegalDocumentAuditLogsParams["action"];
    }
    if (documentTypeFilter !== "all") {
      params.documentType = documentTypeFilter as LegalDocumentType;
    }
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    return params;
  }, [page, searchQuery, actionFilter, documentTypeFilter, dateFrom, dateTo]);

  const { data, isLoading, error } = useLegalDocumentAuditLogs(apiParams);

  const logs = data?.logs ?? [];
  const visibleLogs = visibleLegalDocumentAuditLogs(logs);
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    actionFilter !== "all" ||
    documentTypeFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const appliedFilters: FilterChip[] = [];
  if (actionFilter !== "all") {
    appliedFilters.push({
      id: "action",
      label: `Event: ${actionLabel(actionFilter)}`,
      onRemove: () => setActionFilter("all"),
    });
  }
  if (documentTypeFilter !== "all") {
    appliedFilters.push({
      id: "type",
      label: `Type: ${LEGAL_DOCUMENT_TYPE_LABELS[documentTypeFilter as LegalDocumentType] ?? documentTypeFilter}`,
      onRemove: () => setDocumentTypeFilter("all"),
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
    setActionFilter("all");
    setDocumentTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleReload = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "legal-document-audit-logs"] });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { page: _page, pageSize: _pageSize, ...exportParams } = apiParams;
      const blob = await exportLogs(exportParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `legal-document-audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
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

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter, documentTypeFilter, dateFrom, dateTo]);

  const openDetails = (row: LegalDocumentAuditLogListItem) => {
    setSelectedLog(row);
    setDetailOpen(true);
  };

  if (error) {
    return <AdminQueryErrorState error={error} resourceLabel="legal document audit logs" />;
  }

  return (
    <div className="space-y-6">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by actor, document ID, version ID, or event..."
        appliedFilters={appliedFilters}
        onClearFilters={hasActiveFilters ? clearFilters : undefined}
        onReload={handleReload}
        isLoading={isLoading}
        countLabel={auditRecordCountLabel(totalCount)}
        filterGroups={
          <AuditLogFilters
            activeCount={
              [actionFilter !== "all", documentTypeFilter !== "all", Boolean(dateFrom), Boolean(dateTo)].filter(
                Boolean
              ).length
            }
          >
            <AuditLogFilterSection title="Event">
              <AuditLogFilterOption selected={actionFilter === "all"} onSelect={() => setActionFilter("all")}>
                All events
              </AuditLogFilterOption>
              {ACTION_OPTIONS.map((option) => (
                <AuditLogFilterOption
                  key={option.value}
                  selected={actionFilter === option.value}
                  onSelect={() => setActionFilter(option.value)}
                >
                  {option.label}
                </AuditLogFilterOption>
              ))}
            </AuditLogFilterSection>
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
            <AuditLogHead>Actor</AuditLogHead>
            <AuditLogHead>Document</AuditLogHead>
            <AuditLogHead>Version</AuditLogHead>
            <AuditLogHead>IP Address</AuditLogHead>
            <AuditLogHead align="right">Actions</AuditLogHead>
          </AuditLogHeaderRow>
          <TableBody>
            {isLoading ? (
              <AuditLogSkeletonRows columns={COLUMN_COUNT} />
            ) : visibleLogs.length === 0 ? (
              <AuditLogEmptyRow colSpan={COLUMN_COUNT} />
            ) : (
              visibleLogs.map((row) => (
                <TableRow key={row.id} className={AUDIT_ROW_CLASS} onClick={() => openDetails(row)}>
                  <TableCell className={AUDIT_TIMESTAMP_CELL_CLASS}>
                    {formatAuditDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <AuditEventBadge eventType={row.action} label={actionLabel(row.action)} />
                  </TableCell>
                  <AuditLogActorCell name={row.actorName} email={row.actorEmail} />
                  <TableCell className="max-w-[200px] truncate text-ui">
                    {row.documentType
                      ? LEGAL_DOCUMENT_TYPE_LABELS[row.documentType]
                      : (row.legalDocumentId ?? "—")}
                  </TableCell>
                  <TableCell className="text-ui tabular-nums">
                    {row.versionNumber != null ? `v${row.versionNumber}` : "—"}
                  </TableCell>
                  <TableCell className={AUDIT_IP_CELL_CLASS}>{row.ipAddress ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <AuditLogViewDetailsButton
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetails(row);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </AuditLogTable>
      </AuditLogTableShell>

      <AuditDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        record={
          selectedLog
            ? legalAuditToAuditDetail(selectedLog, companionInitialVersionUpload(selectedLog, logs))
            : null
        }
      />
    </div>
  );
}
