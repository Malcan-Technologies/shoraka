"use client";

import * as React from "react";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { LEGAL_DOCUMENT_TYPE_LABELS, type PortalType } from "@cashsouk/types";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import { LegalAcceptanceDetailSheet } from "@/components/legal-acceptance-detail-sheet";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLegalDocumentAcceptances } from "@/hooks/use-legal-document-acceptances";
import {
  formatLegalAcceptanceDate,
  legalAcceptanceStatusLabel,
  legalAcceptanceStatusToken,
} from "@/lib/legal-acceptance-display";
import { adminActionRowClass } from "@/lib/admin-status-token";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";

const PAGE_SIZE = 20;

export function OrganizationLegalAcceptancesPanel({
  portal,
  organizationId,
}: {
  portal: PortalType;
  organizationId: string;
}) {
  const [page, setPage] = React.useState(1);
  const [selectedAcceptanceId, setSelectedAcceptanceId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const { data, isLoading, error } = useLegalDocumentAcceptances({
    page,
    pageSize: PAGE_SIZE,
    organizationId,
    audience: portal === "issuer" ? "ISSUER" : "INVESTOR",
    sortBy: "accepted_at",
    sortOrder: "desc",
  });

  const acceptances = data?.acceptances ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);
  const startIndex = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <>
      <Card className="rounded-2xl">
        <AdminDetailCardHeader
          icon={ClipboardDocumentCheckIcon}
          title="Legal acceptances"
          description="Open and accept evidence for this organisation"
        />
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-ui text-destructive">
              {error instanceof Error ? error.message : "Failed to load legal acceptances"}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Accepted at</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Accepted by</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : acceptances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <ClipboardDocumentCheckIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p className="text-ui">No legal acceptances for this organisation</p>
                      <p className="mt-1 text-meta">
                        Records appear when this account opens or accepts legal documents
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  acceptances.map((row) => (
                    <TableRow
                      key={row.id}
                      className={adminActionRowClass(legalAcceptanceStatusToken(row.status))}
                    >
                      <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
                        {formatLegalAcceptanceDate(row.acceptedAt)}
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
                      <TableCell className="max-w-[160px] text-ui">
                        <p className="truncate">{row.userName ?? "—"}</p>
                      </TableCell>
                      <TableCell className="max-w-[180px] text-ui text-muted-foreground">
                        <p className="truncate">{row.userEmail ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={legalAcceptanceStatusLabel(row.status)}
                          status={legalAcceptanceStatusToken(row.status)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAcceptanceId(row.id);
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
            {totalCount > 0 ? (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalCount}
                onPageChange={setPage}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <LegalAcceptanceDetailSheet
        acceptanceId={selectedAcceptanceId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
