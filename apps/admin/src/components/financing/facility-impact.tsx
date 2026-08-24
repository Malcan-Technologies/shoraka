"use client";

import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { facilityImpactCopy } from "@cashsouk/types";
import { shouldShowFacilityImpact } from "@/lib/facility-capacity-display";

export function FacilityImpact({
  contractId,
  contractHref,
  contractLabel,
  applicationHref,
  financingAmount,
  invoiceFace,
  invoiceStatus,
  noteStatus,
  servicingStatus,
}: {
  contractId?: string | null;
  contractHref?: string | null;
  contractLabel?: string | null;
  applicationHref?: string | null;
  financingAmount?: number | null;
  invoiceFace?: number | null;
  invoiceStatus?: string | null;
  noteStatus?: string | null;
  servicingStatus?: string | null;
}) {
  if (!shouldShowFacilityImpact(contractId)) return null;
  const copy = facilityImpactCopy({ invoiceStatus, noteStatus, servicingStatus });

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
      aria-labelledby="admin-facility-impact-heading"
    >
      <h3 id="admin-facility-impact-heading" className="text-ui font-semibold text-foreground">
        Facility impact
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-meta text-muted-foreground">Financing amount</p>
          <p className="mt-1 text-ui font-semibold tabular-nums">
            {financingAmount != null ? formatCurrency(financingAmount) : "—"}
          </p>
          <p className="text-meta text-muted-foreground">Uses credit facility</p>
        </div>
        <div>
          <p className="text-meta text-muted-foreground">Invoice face allocation</p>
          <p className="mt-1 text-ui font-semibold tabular-nums">
            {invoiceFace != null ? formatCurrency(invoiceFace) : "—"}
          </p>
          <p className="text-meta text-muted-foreground">Uses contract allocation</p>
        </div>
      </div>
      <p className="text-ui leading-6 text-muted-foreground">{copy.statusWording}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-ui">
        {contractHref ? (
          <Link
            href={contractHref}
            className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {contractLabel ?? "Open facility"}
          </Link>
        ) : null}
        {applicationHref ? (
          <Link
            href={applicationHref}
            className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Open application
          </Link>
        ) : null}
      </div>
    </section>
  );
}
