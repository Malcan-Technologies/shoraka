"use client";

import { facilityImpactCopy } from "@cashsouk/types";
import { shouldShowFacilityImpact } from "@/lib/facility-capacity-display";
import { FacilityTiedLink } from "./facility-tied-link";
import { LabelValue, formatMoney } from "./utils";

export function FacilityImpactSection({
  contractId,
  displayReference,
  financingAmount,
  invoiceFace,
  invoiceStatus,
  noteStatus,
  servicingStatus,
}: {
  contractId?: string | null;
  displayReference?: string | null;
  financingAmount?: unknown;
  invoiceFace?: unknown;
  invoiceStatus?: string | null;
  noteStatus?: string | null;
  servicingStatus?: string | null;
}) {
  if (!shouldShowFacilityImpact(contractId)) return null;
  const copy = facilityImpactCopy({ invoiceStatus, noteStatus, servicingStatus });

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
      aria-labelledby="facility-impact-heading"
    >
      <h3 id="facility-impact-heading" className="text-base font-semibold text-foreground">
        Facility impact
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <LabelValue label="Financing amount" tabular>
          {formatMoney(financingAmount)}
        </LabelValue>
        <LabelValue label="Invoice face allocation" tabular>
          {formatMoney(invoiceFace)}
        </LabelValue>
      </div>
      <p className="text-ui leading-6 text-muted-foreground">{copy.statusWording}</p>
      <FacilityTiedLink contractId={contractId} displayReference={displayReference} />
    </section>
  );
}
