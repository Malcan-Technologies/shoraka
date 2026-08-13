"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 20;

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
  return new Date(dateStr).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm break-all">{value ?? "—"}</p>
    </div>
  );
}

function AuditLogDetailSheet({
  log,
  open,
  onOpenChange,
}: {
  log: LegalAdminAuditLogListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Audit log details</SheetTitle>
          <SheetDescription>Read-only admin legal-document change record.</SheetDescription>
        </SheetHeader>

        {log ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Audit ID" value={log.id} />
              <DetailField label="Event" value={actionLabel(log.eventType)} />
              <DetailField label="Timestamp" value={formatDate(log.occurredAt)} />
              <DetailField
                label="Document type"
                value={metadataString(log.metadata, "documentType") ?? "—"}
              />
              <DetailField
                label="Version"
                value={
                  metadataNumber(log.metadata, "versionNumber") != null
                    ? `v${metadataNumber(log.metadata, "versionNumber")}`
                    : "—"
                }
              />
              <DetailField
                label="File hash"
                value={metadataString(log.metadata, "fileHash")}
              />
              <DetailField label="Legal document ID" value={log.legalDocumentId} />
              <DetailField label="Version ID" value={log.legalDocumentVersionId} />
              <DetailField label="Actor" value={log.actor.displayName} />
              <DetailField label="Actor email" value={log.actor.email} />
              <DetailField label="Actor user ID" value={log.actor.userId} />
              <DetailField label="IP address" value={log.ipAddress} />
              <DetailField label="User agent" value={log.userAgent} />
              <DetailField label="Correlation ID" value={log.correlationId} />
              <DetailField
                label="Reason"
                value={metadataString(log.metadata, "reasonCode")}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Metadata</p>
              <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Legal document audit</h2>
        <p className="mt-1 text-[15px] leading-7 text-muted-foreground">
          Persistent history of admin changes to legal documents and versions
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by actor, document, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 rounded-xl bg-card pl-9"
          />
        </div>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-11 w-[200px] rounded-xl bg-card">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
          <SelectTrigger className="h-11 w-[200px] rounded-xl bg-card">
            <SelectValue placeholder="Document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All document types</SelectItem>
            {LEGAL_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        {hasActiveFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="h-11 gap-2 rounded-xl">
            <XMarkIcon className="h-4 w-4" />
            Clear
          </Button>
        ) : null}

        <Button
          variant="outline"
          onClick={handleReload}
          disabled={isLoading}
          className="h-11 gap-2 rounded-xl bg-card"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Reload
        </Button>

        <Button
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="h-11 gap-2 rounded-xl bg-card"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>

        <Badge
          variant="secondary"
          className="rounded-xl px-3 py-1 text-[13px] font-medium leading-5"
        >
          {totalCount} {totalCount === 1 ? "record" : "records"}
        </Badge>
      </div>

      {error ? (
        <div className="py-8 text-center text-destructive">
          Error loading audit logs:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
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
                      View details
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

      <AuditLogDetailSheet log={selectedLog} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
