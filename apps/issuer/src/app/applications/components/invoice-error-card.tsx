"use client";

import * as React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Invoice item-level amendment errors displayed above the invoice table.
 * Long error messages cannot fit inside table cells; this card aggregates them.
 */
interface InvoiceErrorCardProps {
  /** List of error messages (e.g. "Invoice #3066 amount does not match document") */
  errors: string[];
}

export function InvoiceErrorCard({ errors }: InvoiceErrorCardProps) {
  const lines = React.useMemo(
    () => errors.flatMap((e) => (e || "").split("\n").filter(Boolean)),
    [errors]
  );

  if (lines.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6 flex gap-3">
      <ExclamationTriangleIcon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
      <div>
        <h4 className="font-semibold text-red-600">Invoice issues detected</h4>
        <ul className="mt-2 pl-4 list-disc text-sm text-red-600">
          {lines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
