"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  IdentificationIcon,
} from "@heroicons/react/24/outline";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import { formatNamedEntityDisplay } from "@cashsouk/types";
import {
  AdminCollapsibleCard,
  AdminEntityHeader,
  AdminEntitySummaryCard,
} from "@/components/admin-detail";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { orgHref } from "@/lib/admin-directory-hrefs";
import {
  assignmentNoticeStatusLabel,
  assignmentNoticeStatusToken,
} from "@/lib/admin-status-token";
import { useAdminPaymasterDetail } from "@/paymasters/hooks/use-paymasters";
import { PaymasterVerificationPanel } from "@/paymasters/components/paymaster-verification-panel";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-meta text-muted-foreground">{label}</div>
      <div className="break-words text-ui font-medium">{value || "—"}</div>
    </div>
  );
}

export function PaymasterDetailView({ paymasterId }: { paymasterId: string }) {
  const { can } = usePermissions();
  const canManage = can("paymasters.manage");
  const { data, isLoading, error } = useAdminPaymasterDetail(paymasterId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="text-ui text-destructive">
        {error instanceof Error ? error.message : "Paymaster not found"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <AdminEntityHeader
        variant="hero"
        backHref="/paymasters"
        backLabel="Paymasters"
        eyebrow="Paymaster detail"
        title={data.legalName}
        subtitle={<span className="font-mono">{data.registrationNumber}</span>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminEntitySummaryCard label="Linked issuers" value={String(data.issuers.length)} />
        <AdminEntitySummaryCard label="Financings" value={String(data.financings.length)} />
        <AdminEntitySummaryCard
          label="Notices"
          value={String(data.notices.length)}
        />
      </div>

      <Card className="rounded-2xl">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <DetailRow label="Legal name" value={data.legalName} />
          <DetailRow label="SSM / registration number" value={data.registrationNumber} />
          <DetailRow label="Country" value={data.registrationCountry} />
          <DetailRow label="Entity type" value={data.entityType} />
          <DetailRow
            label="Created"
            value={format(new Date(data.createdAt), "dd MMM yyyy, h:mm a")}
          />
          <DetailRow
            label="Updated"
            value={format(new Date(data.updatedAt), "dd MMM yyyy, h:mm a")}
          />
        </CardContent>
      </Card>

      <AdminCollapsibleCard
        title="Linked issuers"
        icon={BuildingOffice2Icon}
        description="Issuers that have used this Paymaster. Related-party is issuer-specific."
        defaultOpen
      >
        {data.issuers.length === 0 ? (
          <p className="text-ui text-muted-foreground">No issuer links yet.</p>
        ) : (
          <div className="space-y-3">
            {data.issuers.map((issuer) => (
              <div key={issuer.issuerOrganizationId} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                <Link
                  href={orgHref("issuer", issuer.issuerOrganizationId)}
                  className="text-ui font-medium text-primary underline-offset-4 hover:underline"
                >
                  {formatNamedEntityDisplay(issuer.issuerName, issuer.issuerDisplayReference)}
                </Link>
                <span className="text-meta text-muted-foreground">
                  Related party: {issuer.isRelatedParty == null ? "—" : issuer.isRelatedParty ? "Yes" : "No"}
                </span>
              </div>
            ))}
          </div>
        )}
      </AdminCollapsibleCard>

      <AdminCollapsibleCard
        title="Financing history"
        icon={ClipboardDocumentListIcon}
        description="Linked applications, facilities, and notes. Track record is not calculated from this list."
      >
        {data.financings.length === 0 ? (
          <p className="text-ui text-muted-foreground">No financing history yet.</p>
        ) : (
          <div className="space-y-3">
            {data.financings.map((row, index) => (
              <div key={`${row.contractId ?? row.noteId ?? index}`} className="grid gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-3">
                <div className="text-ui">
                  {row.noteReference ? (
                    <Link href={`/notes/${row.noteId}`} className="text-primary underline-offset-4 hover:underline">
                      {row.noteReference}
                    </Link>
                  ) : (
                    row.contractDisplayReference || row.applicationDisplayReference || "—"
                  )}
                </div>
                <div className="text-ui text-muted-foreground">{row.status || "—"}</div>
                <div className="text-ui text-muted-foreground">{row.issuerName || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </AdminCollapsibleCard>

      <AdminCollapsibleCard
        title="Verification"
        icon={IdentificationIcon}
        description="Internal Paymaster identity review. This is not an external SSM or CTOS check."
      >
        <PaymasterVerificationPanel
          paymaster={data}
          paymasterId={data.id}
          canManage={canManage}
          layout="detail"
        />
      </AdminCollapsibleCard>

      <AdminCollapsibleCard
        title="Assignment notices"
        icon={DocumentTextIcon}
        description="Read-only history. Generate and send Notices from the related Note."
      >
        {data.notices.length === 0 ? (
          <p className="text-ui text-muted-foreground">No assignment notices yet.</p>
        ) : (
          <div className="space-y-3">
            {data.notices.map((notice) => (
              <div key={notice.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="text-ui font-medium">
                    {notice.noteReference || notice.invoiceDisplayReference || notice.contractDisplayReference || "Notice"}
                  </div>
                  <div className="text-meta text-muted-foreground">{notice.issuerName || "—"}</div>
                </div>
                <StatusBadge
                  label={assignmentNoticeStatusLabel(notice.status)}
                  status={assignmentNoticeStatusToken(notice.status)}
                />
              </div>
            ))}
          </div>
        )}
      </AdminCollapsibleCard>
    </div>
  );
}
