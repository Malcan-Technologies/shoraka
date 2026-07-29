"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export type ProspectusMissingFinancialYearWarningProps = {
  title: string;
  description: string;
  /** Stable test id — same banner reused on Page 2 and Page 3. */
  testId?: string;
};

/**
 * Non-blocking missing expected-year notice for Prospectus financial tables.
 * Shared across Page 2 comparison and Page 3 yearly tables — not an error.
 */
export function ProspectusMissingFinancialYearWarning({
  title,
  description,
  testId = "financial-comparison-ops-warning",
}: ProspectusMissingFinancialYearWarningProps) {
  return (
    <div
      role="status"
      data-testid={testId}
      className="mb-3 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-foreground dark:bg-amber-950/30"
    >
      <ExclamationTriangleIcon
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
