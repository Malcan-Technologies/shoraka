import Link from "next/link";
import type { NoteDetail } from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="text-xs text-muted-foreground">{label}</div>
      {value ? (
        href ? (
          <Link
            href={href}
            className="block break-all font-mono text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {display ?? value}
          </Link>
        ) : (
          <div className="break-all font-mono text-xs font-medium">{display ?? value}</div>
        )
      ) : (
        <div className="text-sm text-muted-foreground">—</div>
      )}
    </div>
  );
}

export function SourceApplicationPanel({ note }: { note: NoteDetail }) {
  const productKey = getApplicationProductKey(note);
  const applicationHref = productKey
    ? `/applications/${encodeURIComponent(productKey)}/${encodeURIComponent(note.sourceApplicationId)}`
    : null;
  const invoiceHref =
    applicationHref && note.sourceInvoiceId
      ? `${applicationHref}?invoiceId=${encodeURIComponent(note.sourceInvoiceId)}`
      : null;
  const contractHref = note.sourceContractId
    ? `/contracts?contractId=${encodeURIComponent(note.sourceContractId)}`
    : null;
  const organizationHref = `/organizations/issuer/${encodeURIComponent(note.issuerOrganizationId)}`;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Source Application</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <SourceLink label="Application ID" value={note.sourceApplicationId} href={applicationHref} />
        <SourceLink label="Invoice ID" value={note.sourceInvoiceId} href={invoiceHref} />
        <SourceLink label="Contract ID" value={note.sourceContractId} href={contractHref} />
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

