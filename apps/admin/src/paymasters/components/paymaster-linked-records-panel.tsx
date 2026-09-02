"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { EyeIcon, LinkIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import {
  formatNamedEntityDisplay,
  toTitleCase,
  type PaymasterDetail,
  type PaymasterFinancingRow,
  type PaymasterIssuerLinkRow,
} from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
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
import { orgHref } from "@/lib/admin-directory-hrefs";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import {
  isPaymasterFacilityRow,
  isPaymasterNoteRow,
  paymasterFinancingHref,
  paymasterFinancingKind,
  paymasterFinancingTitle,
  type PaymasterLinkedRecordFilter,
} from "@/paymasters/utils/paymaster-linked-records";

const FILTER_PILLS: { value: PaymasterLinkedRecordFilter; label: string }[] = [
  { value: "issuers", label: "Issuers" },
  { value: "facilities", label: "Facilities" },
  { value: "notes", label: "Notes" },
];

function relatedPartyLabel(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function IssuersTable({ issuers }: { issuers: PaymasterIssuerLinkRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Issuer</TableHead>
            <TableHead>Related party</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issuers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                No issuer links yet.
              </TableCell>
            </TableRow>
          ) : (
            issuers.map((issuer) => {
              const href = orgHref("issuer", issuer.issuerOrganizationId);
              const name = formatNamedEntityDisplay(
                issuer.issuerName,
                issuer.issuerDisplayReference
              );
              return (
                <TableRow key={issuer.issuerOrganizationId} className="odd:bg-muted/40 hover:bg-muted">
                  <TableCell className="min-w-[180px] font-medium">
                    <Link href={href} className="text-primary underline-offset-4 hover:underline">
                      {name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-ui text-muted-foreground">
                    {relatedPartyLabel(issuer.isRelatedParty)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
                    {format(new Date(issuer.lastUsedAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                      <Link href={href}>
                        <EyeIcon className="h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function FinancingsTable({
  rows,
  emptyLabel,
}: {
  rows: PaymasterFinancingRow[];
  emptyLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Type</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Issuer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => {
              const href = paymasterFinancingHref(row);
              const token = getAdminStatusToken(row.status ?? "");
              return (
                <TableRow
                  key={`${row.contractId ?? row.noteId ?? row.applicationId ?? index}`}
                  className={cn("odd:bg-muted/40 hover:bg-muted", adminActionRowClass(token))}
                >
                  <TableCell>
                    <Badge variant="outline">{paymasterFinancingKind(row)}</Badge>
                  </TableCell>
                  <TableCell className="min-w-[160px] font-medium">
                    {paymasterFinancingTitle(row)}
                  </TableCell>
                  <TableCell className="text-ui">
                    {row.issuerOrganizationId ? (
                      <Link
                        href={orgHref("issuer", row.issuerOrganizationId)}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {row.issuerName || "—"}
                      </Link>
                    ) : (
                      row.issuerName || "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ui font-semibold">
                    {row.amount == null ? "—" : formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={row.status ? toTitleCase(row.status) : "—"}
                      status={token}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
                    {row.updatedAt ? format(new Date(row.updatedAt), "dd MMM yyyy") : "—"}
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
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function PaymasterLinkedRecordsPanel({ paymaster }: { paymaster: PaymasterDetail }) {
  const [filter, setFilter] = React.useState<PaymasterLinkedRecordFilter>("issuers");
  const facilities = paymaster.financings.filter(isPaymasterFacilityRow);
  const notes = paymaster.financings.filter(isPaymasterNoteRow);
  const counts: Record<PaymasterLinkedRecordFilter, number> = {
    issuers: paymaster.issuers.length,
    facilities: facilities.length,
    notes: notes.length,
  };

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={LinkIcon}
        title="Linked records"
        description="Issuers that have used this Paymaster, plus linked facilities and notes. Related-party is issuer-specific."
      />
      <CardContent className="space-y-4 p-0 pb-4">
        <div className="flex flex-wrap gap-2 px-6">
          {FILTER_PILLS.map((pill) => (
            <Button
              key={pill.value}
              type="button"
              size="sm"
              variant={filter === pill.value ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(pill.value)}
            >
              {pill.label}
              <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-meta">
                {counts[pill.value]}
              </span>
            </Button>
          ))}
        </div>
        <div className="overflow-x-auto px-6">
          {filter === "issuers" ? (
            <IssuersTable issuers={paymaster.issuers} />
          ) : filter === "facilities" ? (
            <FinancingsTable rows={facilities} emptyLabel="No facilities yet." />
          ) : (
            <FinancingsTable rows={notes} emptyLabel="No notes yet." />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
