"use client";

import * as React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Invoice item-level amendment remarks displayed above the invoice table.
 * Matches AmendmentRemarkCard visual style. Uses CashSouk brand tokens (primary).
 */
interface InvoiceAmendmentGroup {
  invoiceLabel: string;
  bullets: string[];
}

interface InvoiceErrorCardProps {
  /** Grouped amendment remarks: invoice label + bullet points. */
  groups?: InvoiceAmendmentGroup[];
  /** @deprecated Use groups. Flat list for backward compatibility. */
  errors?: string[];
}

export function InvoiceErrorCard({ groups = [], errors = [] }: InvoiceErrorCardProps) {
  /** Flatten legacy errors into a single group when groups is empty. */
  const effectiveGroups = React.useMemo((): InvoiceAmendmentGroup[] => {
    if (groups.length > 0) return groups;
    const lines = errors.flatMap((e) => (e || "").split(/\n|\/n/).map((s) => s.trim()).filter(Boolean));
    if (lines.length === 0) return [];
    return [{ invoiceLabel: "Invoices", bullets: lines }];
  }, [groups, errors]);

  if (effectiveGroups.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-6 flex gap-3">
      <ExclamationTriangleIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-primary">Amendments required (invoices)</h4>
        <div className="mt-2 space-y-3">
          {effectiveGroups.map((g, gIdx) => (
            <div key={gIdx}>
              <div className="font-medium text-foreground text-sm">{g.invoiceLabel}</div>
              <ul className="mt-1 pl-4 list-disc text-sm text-foreground">
                {g.bullets.map((b, bIdx) => (
                  <li key={bIdx}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
