"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListToolbar, ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useExportLegalDocumentAuditLogs,
  useLegalDocumentAuditLogs,
  type LegalDocumentAuditLogsParams,
} from "@/hooks/use-legal-document-audit-logs";
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalAdminAuditEventType,
  type LegalAdminAuditLogListItem,
  type LegalDocumentType,
} from "@cashsouk/types";
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { AuditLogDetailSheet } from "@/components/audit/audit-log-detail-sheet";
import { AdminQueryErrorState } from "@/components/admin-query-error-state";
import { formatAuditDateTime } from "@/lib/audit-datetime";
import {
  auditExportFilename,
  downloadAuditExport,
  truncatedExportDescription,
} from "@/lib/download-audit-export";
import { EyeIcon } from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ITEMS_PER_PAGE = 15;

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

const ACTION_OPTIONS: { value: LegalAdminAuditEventType; label: string }[] = [
  { value: "LEGAL_DOCUMENT_CREATED", label: "Document created" },
  { value: "LEGAL_DOCUMENT_UPDATED", label: "Document updated" },
  { value: "LEGAL_DOCUMENT_VERSION_UPLOADED", label: "Version uploaded" },
  { value: "LEGAL_DOCUMENT_VERSION_FILE_REPLACED", label: "Version file replaced" },
  { value: "LEGAL_DOCUMENT_VERSION_PUBLISHED", label: "Version published" },
  { value: "LEGAL_DOCUMENT_VERSION_ARCHIVED", label: "Version archived" },
  { value: "LEGAL_DOCUMENT_VERSION_RESTORED", label: "Version restored" },
];

function formatDate(dateStr: string): string {
  return formatAuditDateTime(dateStr);
}

function actionLabel(eventType: string): string {
  return ACTION_OPTIONS.find((option) => option.value === eventType)?.label ?? eventType;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" ? value : null;
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
  const [selectedLog, setSelectedLog] = React.useState<LegalAdminAuditLogListItem | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const apiParams = React.useMemo((): LegalDocumentAuditLogsParams => {
    const params: LegalDocumentAuditLogsParams = {
      page,
      pageSize: ITEMS_PER_PAGE,
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
      label: `Action: ${actionLabel(actionFilter)}`,
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

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      const result = await exportLogs({
        search: apiParams.search,
        action: apiParams.action,
        documentType: apiParams.documentType,
        dateFrom: apiParams.dateFrom,
        dateTo: apiParams.dateTo,
        format,
      });
      downloadAuditExport(result.blob, auditExportFilename("legal-document-audit-logs", format));
      if (result.truncated) {
        toast.warning("Export truncated", { description: truncatedExportDescription() });
      } else {
        toast.success(`Legal document audit exported as ${format.toUpperCase()}`);
      }
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Could not export logs",
      });
    } finally {
      setExporting(false);
    }
  };

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter, documentTypeFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by actor, document, or action..."
        appliedFilters={appliedFilters}
        onClearFilters={hasActiveFilters ? clearFilters : undefined}
        onReload={handleReload}
        isLoading={isLoading}
        countLabel={`${totalCount} ${totalCount === 1 ? "record" : "records"}`}
        filterGroups={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ListToolbarFilterTrigger label="Action" count={actionFilter !== "all" ? 1 : 0} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Action</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={actionFilter} onValueChange={setActionFilter}>
                  <DropdownMenuRadioItem value="all">All actions</DropdownMenuRadioItem>
                  {ACTION_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ListToolbarFilterTrigger
                  label="Type"
                  count={documentTypeFilter !== "all" ? 1 : 0}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Document type</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={documentTypeFilter}
                  onValueChange={setDocumentTypeFilter}
                >
                  <DropdownMenuRadioItem value="all">All document types</DropdownMenuRadioItem>
                  {LEGAL_TYPES.map((type) => (
                    <DropdownMenuRadioItem key={type.value} value={type.value}>
                      {type.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-11 w-[160px] rounded-xl bg-card"
          aria-label="Date from"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-11 w-[160px] rounded-xl bg-card"
          aria-label="Date to"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={exporting}
              className="h-11 gap-2 rounded-xl bg-card"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void handleExport("csv")} disabled={exporting}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleExport("json")} disabled={exporting}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ListToolbar>

      {error ? (
        <AdminQueryErrorState error={error} resourceLabel="legal document audit" />
      ) : null}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>IP</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No legal document audit records found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(row.occurredAt)}
                  </TableCell>
                  <TableCell className="text-sm">{actionLabel(row.eventType)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {metadataString(row.metadata, "documentType")
                      ? LEGAL_DOCUMENT_TYPE_LABELS[
                          metadataString(row.metadata, "documentType") as LegalDocumentType
                        ]
                      : row.legalDocumentId}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {metadataNumber(row.metadata, "versionNumber") != null
                      ? `v${metadataNumber(row.metadata, "versionNumber")}`
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm">
                    {row.actor.displayName ?? row.actor.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedLog(row);
                        setDetailOpen(true);
                      }}
                    >
                      <EyeIcon className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({totalCount} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRightIcon className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <AuditLogDetailSheet
        log={
          selectedLog
            ? {
                id: selectedLog.id,
                eventType: selectedLog.eventType,
                eventLabel: actionLabel(selectedLog.eventType),
                occurredAt: selectedLog.occurredAt,
                createdAt: selectedLog.createdAt,
                actorType: selectedLog.actor.type,
                actorName: selectedLog.actor.displayName,
                actorEmail: selectedLog.actor.email,
                actorUserId: selectedLog.actor.userId,
                targetType: selectedLog.target.type,
                targetId: selectedLog.target.id,
                source: selectedLog.source,
                portal: selectedLog.portal,
                ipAddress: selectedLog.ipAddress,
                userAgent: selectedLog.userAgent,
                correlationId: selectedLog.correlationId,
                extraFields: [
                  { label: "Legal document ID", value: selectedLog.legalDocumentId },
                  { label: "Version ID", value: selectedLog.legalDocumentVersionId },
                  {
                    label: "Document type",
                    value: metadataString(selectedLog.metadata, "documentType"),
                  },
                  {
                    label: "Version",
                    value:
                      metadataNumber(selectedLog.metadata, "versionNumber") != null
                        ? `v${metadataNumber(selectedLog.metadata, "versionNumber")}`
                        : null,
                  },
                  { label: "File hash", value: metadataString(selectedLog.metadata, "fileHash") },
                  { label: "Reason", value: metadataString(selectedLog.metadata, "reasonCode") },
                ],
                metadata: selectedLog.metadata,
              }
            : null
        }
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Legal Documents audit"
        description="Read-only admin legal-document change record."
      />
    </div>
  );
}
