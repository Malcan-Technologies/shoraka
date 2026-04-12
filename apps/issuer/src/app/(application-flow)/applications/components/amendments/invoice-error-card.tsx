"use client";

import * as React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  AMENDMENT_CALLOUT_BODY,
  AMENDMENT_CALLOUT_CONTENT,
  AMENDMENT_CALLOUT_ICON_WRAP,
  AMENDMENT_CALLOUT_ROOT,
  AMENDMENT_CALLOUT_TITLE,
} from "./amendment-callout-styles";

/**
 * Invoice item-level amendment remarks above the invoice table.
 * Same shell + typography as AmendmentRemarkCard; body lists per-invoice bullets.
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
    <div
      className={`${AMENDMENT_CALLOUT_ROOT} mb-6 border-primary/55 bg-primary/10 text-foreground`}
    >
      <div
        className={`${AMENDMENT_CALLOUT_ICON_WRAP} bg-primary/20 border-primary/45`}
        aria-hidden
      >
        <ExclamationTriangleIcon className="h-5 w-5 text-primary" />
      </div>
      <div className={`${AMENDMENT_CALLOUT_BODY} flex-1`}>
        <p className={`${AMENDMENT_CALLOUT_TITLE} text-primary`}>
          Amendments required (invoices)
        </p>
        <div className={`${AMENDMENT_CALLOUT_CONTENT} space-y-3 text-foreground`}>
          {effectiveGroups.map((g, gIdx) => (
            <div key={gIdx}>
              <div className="font-medium text-foreground">{g.invoiceLabel}</div>
              <ul className="mt-1 pl-4 list-disc space-y-1.5">
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
