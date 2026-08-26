"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListToolbar, PortalBadge, StatusBadge, type FilterChip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { LegalAcceptanceDetailSheet } from "@/components/legal-acceptance-detail-sheet";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { adminActionRowClass } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import {
  LEGAL_ACCEPTANCE_STATUS_OPTIONS,
  legalAcceptanceStatusLabel,
  legalAcceptanceStatusToken,
} from "@/lib/legal-acceptance-display";
import {
  useExportLegalDocumentAcceptances,
  useLegalDocumentAcceptances,
  type LegalDocumentAcceptancesParams,
} from "@/hooks/use-legal-document-acceptances";
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalAcceptanceAudience,
  type LegalAcceptanceStatus,
  type LegalDocumentAcceptanceListItem,
  type LegalDocumentType,
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
import { formatAuditDateTime } from "@/components/audit/audit-presentation";

const COLUMN_COUNT = 10;

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

const AUDIENCE_OPTIONS: { value: LegalAcceptanceAudience; label: string }[] = [
  { value: "ISSUER", label: "Issuer" },
  { value: "INVESTOR", label: "Investor" },
];

export default function LegalDocumentAcceptancesPage() {
  const queryClient = useQueryClient();
  const exportAcceptances = useExportLegalDocumentAcceptances();

  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = React.useState<string>("all");
  const [audienceFilter, setAudienceFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [selectedAcceptanceId, setSelectedAcceptanceId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const apiParams = React.useMemo((): LegalDocumentAcceptancesParams => {
    const params: LegalDocumentAcceptancesParams = {
      page,
      pageSize: AUDIT_LOG_PAGE_SIZE,
      sortBy: "accepted_at",
      sortOrder: "desc",
    };

    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (documentTypeFilter !== "all") {
      params.documentType = documentTypeFilter as LegalDocumentType;
    }
    if (audienceFilter !== "all") {
      params.audience = audienceFilter as LegalAcceptanceAudience;
    }
    if (statusFilter !== "all") {
      params.status = statusFilter as LegalAcceptanceStatus;
    }
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    return params;
  }, [page, searchQuery, documentTypeFilter, audienceFilter, statusFilter, dateFrom, dateTo]);

  const { data, isLoading, error } = useLegalDocumentAcceptances(apiParams);

  const acceptances = data?.acceptances ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    documentTypeFilter !== "all" ||
    audienceFilter !== "all" ||
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
  if (audienceFilter !== "all") {
    appliedFilters.push({
      id: "audience",
      label: `Portal: ${AUDIENCE_OPTIONS.find((option) => option.value === audienceFilter)?.label ?? audienceFilter}`,
      onRemove: () => setAudienceFilter("all"),
    });
  }
  if (statusFilter !== "all") {
    appliedFilters.push({
      id: "status",
      label: `Status: ${legalAcceptanceStatusLabel(statusFilter as LegalAcceptanceStatus)}`,
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
    setAudienceFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleReload = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "legal-document-acceptances"] });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { page: _page, pageSize: _pageSize, ...exportParams } = apiParams;
      const blob = await exportAcceptances(exportParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `legal-document-acceptances-${new Date().toISOString().split("T")[0]}.csv`;
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

  const openDetails = (row: LegalDocumentAcceptanceListItem) => {
    setSelectedAcceptanceId(row.id);
    setDetailOpen(true);
  };

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, documentTypeFilter, audienceFilter, statusFilter, dateFrom, dateTo]);

  if (error) {
    return (
      <RequirePermission permission="document_management.view">
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="w-full space-y-6 px-2 py-8 md:px-4">
            <AdminPageHeader
              title="Legal Acceptances"
              description="Evidence records when users open or accept legal documents"
            />
            <AdminQueryErrorState error={error} resourceLabel="legal acceptances" />
          </div>
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission="document_management.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <AdminPageHeader
            title="Legal Acceptances"
            description="Evidence records when users open or accept legal documents"
          />

          <ListToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name, email, or organization..."
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
                    audienceFilter !== "all",
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
                <AuditLogFilterSection title="Portal">
                  <AuditLogFilterOption
                    selected={audienceFilter === "all"}
                    onSelect={() => setAudienceFilter("all")}
                  >
                    All portals
                  </AuditLogFilterOption>
                  {AUDIENCE_OPTIONS.map((option) => (
                    <AuditLogFilterOption
                      key={option.value}
                      selected={audienceFilter === option.value}
                      onSelect={() => setAudienceFilter(option.value)}
                    >
                      {option.label}
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
                  {LEGAL_ACCEPTANCE_STATUS_OPTIONS.map((option) => (
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
              disabled={exporting}
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
                <AuditLogHead>Organisation</AuditLogHead>
                <AuditLogHead>Document</AuditLogHead>
                <AuditLogHead>Version</AuditLogHead>
                <AuditLogHead>Portal</AuditLogHead>
                <AuditLogHead>IP Address</AuditLogHead>
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
                    const timestamp = row.acceptedAt || row.openedAt || row.createdAt;
                    const eventLabel = legalAcceptanceStatusLabel(row.status);
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
                        <AuditLogActorCell name={row.userName} email={row.userEmail} />
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
                        <TableCell>
                          <PortalBadge portal={row.portal} />
                        </TableCell>
                        <TableCell className={AUDIT_IP_CELL_CLASS}>
                          {row.acceptedIpAddress ?? row.openedIpAddress ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={eventLabel} status={token} />
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
        </div>
      </div>

      <LegalAcceptanceDetailSheet
        acceptanceId={selectedAcceptanceId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </RequirePermission>
  );
}
