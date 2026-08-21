"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { EyeIcon, LinkIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import {
  formatApplicationReference,
  formatContractReference,
  formatNoteReference,
  toTitleCase,
  type OrganizationLinkedRecordRow,
  type OrganizationLinkedRecordType,
  type PortalType,
} from "@cashsouk/types";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Badge } from "@/components/ui/badge";
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
import { useOrganizationLinkedRecords } from "@/organizations/hooks/use-organization-linked-records";
import {
  organizationLinkedRecordHref,
  organizationLinkedRecordTypeLabel,
} from "@/organizations/utils/organization-linked-record-href";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const ISSUER_TYPE_PILLS: { value: Exclude<OrganizationLinkedRecordType, "investments">; label: string }[] = [
  { value: "applications", label: "Applications" },
  { value: "contracts", label: "Facilities" },
  { value: "notes", label: "Notes" },
];

function linkedRecordTitle(row: OrganizationLinkedRecordRow): string {
  if (row.type === "application") {
    return formatApplicationReference({ displayReference: row.displayReference, id: row.id });
  }
  if (row.type === "contract") {
    return formatContractReference({
      displayReference: row.displayReference,
      businessNumber: row.contractNumber,
      id: row.id,
    });
  }
  if (row.type === "note") {
    return formatNoteReference({ noteReference: row.displayReference, id: row.id });
  }
  return formatNoteReference({
    noteReference: row.displayReference ?? row.title,
    id: row.noteId ?? row.id,
  });
}

export function OrganizationLinkedRecordsPanel({
  portal,
  organizationId,
}: {
  portal: PortalType;
  organizationId: string;
}) {
  const isInvestor = portal === "investor";
  const [type, setType] = React.useState<OrganizationLinkedRecordType>(
    isInvestor ? "investments" : "applications"
  );
  const [page, setPage] = React.useState(1);
  const { data, isLoading, error } = useOrganizationLinkedRecords({
    portal,
    id: organizationId,
    type,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);
  const startIndex = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, totalCount);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleTypeChange = (next: OrganizationLinkedRecordType) => {
    setType(next);
    setPage(1);
  };

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={LinkIcon}
        title="Linked records"
        description={
          isInvestor
            ? "Investments this investor has committed to. Wallet deposits and withdrawals are under Activity."
            : "Applications, facilities, and notes connected to this organization."
        }
      />
      <CardContent className="space-y-4 p-0 pb-4">
        {isInvestor ? null : (
          <div className="flex flex-wrap gap-2 px-6">
            {ISSUER_TYPE_PILLS.map((pill) => {
              const count =
                pill.value === "applications"
                  ? (counts.applications ?? 0)
                  : pill.value === "contracts"
                    ? (counts.contracts ?? 0)
                    : (counts.notes ?? 0);
              return (
                <Button
                  key={pill.value}
                  type="button"
                  size="sm"
                  variant={type === pill.value ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => handleTypeChange(pill.value)}
                >
                  {pill.label}
                  <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-meta">
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        {error ? (
          <div className="px-6 py-4 text-ui text-destructive">
            Failed to load linked records:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto px-6">
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 4 }).map((_, idx) => (
                          <TableRow key={idx}>
                            {Array.from({ length: 6 }).map((__, jdx) => (
                              <TableCell key={jdx}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : items.length === 0
                        ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                No linked records found for this filter.
                              </TableCell>
                            </TableRow>
                          )
                        : items.map((row) => {
                            const href = organizationLinkedRecordHref(row);
                            const title = linkedRecordTitle(row);
                            return (
                              <TableRow
                                key={`${row.type}-${row.id}`}
                                className={cn(
                                  "odd:bg-muted/40 hover:bg-muted",
                                  adminActionRowClass(getAdminStatusToken(row.status))
                                )}
                              >
                                <TableCell>
                                  <Badge variant="outline">
                                    {organizationLinkedRecordTypeLabel(row.type)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="min-w-[220px]">
                                  <div className="font-medium">{title}</div>
                                  {row.title && row.title !== title ? (
                                    <div
                                      className="mt-0.5 max-w-sm truncate font-mono text-meta text-muted-foreground"
                                      title={row.title}
                                    >
                                      {row.title}
                                    </div>
                                  ) : null}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-ui font-semibold">
                                  {row.amount == null ? "—" : formatCurrency(row.amount)}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge
                                    label={toTitleCase(row.status)}
                                    status={getAdminStatusToken(row.status)}
                                  />
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
                                  {format(new Date(row.updatedAt), "dd MMM yyyy")}
                                </TableCell>
                                <TableCell>
                                  {href ? (
                                    <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                                      <Link href={href}>
                                        <EyeIcon className="h-4 w-4" />
                                        View
                                      </Link>
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" className="h-8 px-2" disabled>
                                      <EyeIcon className="h-4 w-4" />
                                      View
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                  </TableBody>
                </Table>
              </div>
            </div>
            {!isLoading && totalCount > 0 ? (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalCount}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
