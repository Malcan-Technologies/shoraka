"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHeader } from "@cashsouk/ui";
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
import { RequirePermission } from "@/components/require-permission";
import {
  useDownloadAcceptedVersion,
  useExportLegalDocumentAcceptances,
  useLegalDocumentAcceptanceDetail,
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
import { formatLegalFileSize } from "@/lib/legal-documents-admin";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 20;

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

const STATUS_OPTIONS: { value: LegalAcceptanceStatus; label: string }[] = [
  { value: "NOT_OPENED", label: "Not opened" },
  { value: "OPENED", label: "Opened" },
  { value: "ACCEPTED", label: "Accepted" },
];

const AUDIENCE_OPTIONS: { value: LegalAcceptanceAudience; label: string }[] = [
  { value: "ISSUER", label: "Issuer" },
  { value: "INVESTOR", label: "Investor" },
];

function formatAcceptanceDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function portalLabel(type: LegalAcceptanceAudience): string {
  return type === "ISSUER" ? "Issuer" : "Investor";
}

function statusLabel(status: LegalAcceptanceStatus): string {
  const match = STATUS_OPTIONS.find((option) => option.value === status);
  return match?.label ?? status;
}

function statusBadgeVariant(
  status: LegalAcceptanceStatus
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "ACCEPTED") return "default";
  if (status === "OPENED") return "secondary";
  return "outline";
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm break-all">{value ?? "—"}</p>
    </div>
  );
}

function AcceptanceDetailSheet({
  acceptanceId,
  open,
  onOpenChange,
}: {
  acceptanceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const downloadAcceptedVersion = useDownloadAcceptedVersion();
  const { data: acceptance, isLoading, error } = useLegalDocumentAcceptanceDetail(
    open ? acceptanceId : null
  );
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (!acceptanceId) return;
    setDownloading(true);
    try {
      await downloadAcceptedVersion(acceptanceId);
    } catch (err) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Could not download PDF",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Acceptance details</SheetTitle>
          <SheetDescription>
            Read-only evidence record for this legal document acceptance.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load details"}
          </p>
        ) : acceptance ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Acceptance ID" value={acceptance.id} />
              <DetailField
                label="Status"
                value={
                  <Badge variant={statusBadgeVariant(acceptance.status)}>
                    {statusLabel(acceptance.status)}
                  </Badge>
                }
              />
              <DetailField
                label="Accepted at"
                value={formatAcceptanceDate(acceptance.acceptedAt)}
              />
              <DetailField label="Opened at" value={formatAcceptanceDate(acceptance.openedAt)} />
              <DetailField label="Created at" value={formatAcceptanceDate(acceptance.createdAt)} />
              <DetailField
                label="Document"
                value={
                  acceptance.documentType
                    ? LEGAL_DOCUMENT_TYPE_LABELS[acceptance.documentType]
                    : acceptance.documentTitle
                }
              />
              <DetailField
                label="Version"
                value={acceptance.versionNumber != null ? `v${acceptance.versionNumber}` : "—"}
              />
              <DetailField label="File name" value={acceptance.fileName} />
              <DetailField label="Document hash" value={acceptance.documentHash} />
              <DetailField label="Organization" value={acceptance.organizationName} />
              <DetailField label="Organization ID" value={acceptance.organizationId} />
              <DetailField
                label="Portal"
                value={portalLabel(acceptance.organizationType)}
              />
              <DetailField label="Accepted by" value={acceptance.userName} />
              <DetailField label="User ID" value={acceptance.userId} />
              <DetailField label="Email" value={acceptance.userEmail} />
              <DetailField label="IP address" value={acceptance.ipAddress} />
              <DetailField label="User agent" value={acceptance.userAgent} />
              <DetailField label="Device info" value={acceptance.deviceInfo} />
              <DetailField
                label="Version status"
                value={acceptance.versionStatus ?? "—"}
              />
              <DetailField label="Content type" value={acceptance.contentType} />
              <DetailField
                label="File size"
                value={
                  acceptance.fileSize != null
                    ? formatLegalFileSize(acceptance.fileSize)
                    : "—"
                }
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Acknowledgement text</p>
              <p className="rounded-lg border bg-muted/30 p-3 text-sm">
                {acceptance.acknowledgementText ?? "—"}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
              {downloading ? "Preparing download..." : "Download accepted version"}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function LegalDocumentAcceptancesPage() {
  const { setTitle } = useHeader();
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

  React.useEffect(() => {
    setTitle("Legal Acceptances");
    return () => setTitle("");
  }, [setTitle]);

  const apiParams = React.useMemo((): LegalDocumentAcceptancesParams => {
    const params: LegalDocumentAcceptancesParams = {
      page,
      pageSize: ITEMS_PER_PAGE,
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

  return (
    <RequirePermission permission="document_management.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Legal Acceptances</h1>
            <p className="mt-1 text-[15px] leading-7 text-muted-foreground">
              Evidence records when users open or accept legal documents
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or organization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl bg-card pl-9"
              />
            </div>

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

            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger className="h-11 w-[140px] rounded-xl bg-card">
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All portals</SelectItem>
                {AUDIENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-[150px] rounded-xl bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
              Error loading legal acceptances:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Accepted at</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Accepted by</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : acceptances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                      <ClipboardDocumentCheckIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>No legal acceptances found</p>
                      <p className="mt-1 text-sm">
                        Acceptance records will appear here when users interact with legal documents
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  acceptances.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatAcceptanceDate(row.acceptedAt)}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm">
                        <p className="truncate font-medium" title={row.documentTitle}>
                          {row.documentType
                            ? LEGAL_DOCUMENT_TYPE_LABELS[row.documentType]
                            : row.documentTitle}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {row.versionNumber != null ? `v${row.versionNumber}` : "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] text-sm">
                        <p className="truncate" title={row.organizationName ?? undefined}>
                          {row.organizationName ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {portalLabel(row.organizationType)}
                      </TableCell>
                      <TableCell className="max-w-[160px] text-sm">
                        <p className="truncate" title={row.userName ?? undefined}>
                          {row.userName ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[180px] text-sm">
                        <p className="truncate text-muted-foreground" title={row.userEmail ?? undefined}>
                          {row.userEmail ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.ipAddress ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetails(row)}>
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
        </div>
      </div>

      <AcceptanceDetailSheet
        acceptanceId={selectedAcceptanceId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </RequirePermission>
  );
}
