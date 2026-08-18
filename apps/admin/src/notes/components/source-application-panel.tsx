"use client";

import Link from "next/link";
import { LinkIcon } from "@heroicons/react/24/outline";
import type { NoteDetail } from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveNoteSourceLinkage } from "@/notes/utils/note-source-linkage";
import { orgHref } from "@/lib/admin-directory-hrefs";
import { usePermissions } from "@/hooks/use-permissions";

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function getApplicationProductKey(note: NoteDetail) {
  const snapshot = note.productSnapshot;
  return (
    readString(snapshot?.product_id) ??
    readString(snapshot?.productId) ??
    readString(snapshot?.baseProductId) ??
    readString(snapshot?.base_product_id) ??
    readString(snapshot?.id)
  );
}

function SourceLink({
  label,
  value,
  href,
  display,
}: {
  label: string;
  value: string | null;
  href?: string | null;
  display?: string | null;
}) {
  return (
    <div className="space-y-1">
      <div className="text-meta text-muted-foreground">{label}</div>
      {value ? (
        href ? (
          <Link
            href={href}
            className="block break-all font-mono text-ui font-medium text-primary underline-offset-4 hover:underline"
          >
            {display ?? value}
          </Link>
        ) : (
          <div className="break-all font-mono text-ui font-medium">{display ?? value}</div>
        )
      ) : (
        <div className="text-ui text-muted-foreground">—</div>
      )}
    </div>
  );
}

export function SourceApplicationPanel({ note }: { note: NoteDetail }) {
  const { can } = usePermissions();
  const productKey = getApplicationProductKey(note);
  const applicationHref = productKey
    ? `/applications/${encodeURIComponent(productKey)}/${encodeURIComponent(note.sourceApplicationId)}`
    : null;
  const invoiceHref =
    applicationHref && note.sourceInvoiceId
      ? `${applicationHref}?invoiceId=${encodeURIComponent(note.sourceInvoiceId)}`
      : null;
  const linkage = resolveNoteSourceLinkage(note);
  const organizationHref = can("organizations.view")
    ? orgHref("issuer", note.issuerOrganizationId)
    : null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <LinkIcon className="h-4 w-4 text-primary" />
        </div>
        <CardTitle>Quick Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-ui">
        <SourceLink label="Application ID" value={note.sourceApplicationId} href={applicationHref} />
        <SourceLink label="Invoice ID" value={note.sourceInvoiceId} href={invoiceHref} />
        {linkage.isStandalone ? null : (
          <SourceLink
            label="Facility ID"
            value={linkage.contractId}
            href={linkage.contractHref}
          />
        )}
        <SourceLink
          label="Issuer Organization"
          value={note.issuerOrganizationId}
          href={organizationHref}
          display={note.issuerName ? `${note.issuerName} (${note.issuerOrganizationId})` : note.issuerOrganizationId}
        />
      </CardContent>
    </Card>
  );
}

