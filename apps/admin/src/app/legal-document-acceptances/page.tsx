"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ListToolbar,
  ListToolbarFilterTrigger,
  PortalBadge,
  StatusBadge,
  type FilterChip,
} from "@cashsouk/ui";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { LegalAcceptanceDetailSheet } from "@/components/legal-acceptance-detail-sheet";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { adminActionRowClass } from "@/lib/admin-status-token";
import {
  formatLegalAcceptanceDate,
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
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 20;

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
            countLabel={`${totalCount} ${totalCount === 1 ? "record" : "records"}`}
            filterGroups={
              <>
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <ListToolbarFilterTrigger
                      label="Portal"
                      count={audienceFilter !== "all" ? 1 : 0}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Portal</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={audienceFilter} onValueChange={setAudienceFilter}>
                      <DropdownMenuRadioItem value="all">All portals</DropdownMenuRadioItem>
                      {AUDIENCE_OPTIONS.map((option) => (
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
                      label="Status"
                      count={statusFilter !== "all" ? 1 : 0}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                      <DropdownMenuRadioItem value="all">All statuses</DropdownMenuRadioItem>
                      {LEGAL_ACCEPTANCE_STATUS_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
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
            <Button
              variant="outline"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="h-11 gap-2 rounded-xl bg-card"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </ListToolbar>

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
                  <TableHead>Accepted IP</TableHead>
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
                    <TableRow key={row.id} className={adminActionRowClass(legalAcceptanceStatusToken(row.status))}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatLegalAcceptanceDate(row.acceptedAt)}
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
                      <TableCell>
                        <PortalBadge portal={row.portal} />
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
                        {row.acceptedIpAddress ?? row.openedIpAddress ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={legalAcceptanceStatusLabel(row.status)}
                          status={legalAcceptanceStatusToken(row.status)}
                        />
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

      <LegalAcceptanceDetailSheet
        acceptanceId={selectedAcceptanceId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </RequirePermission>
  );
}
