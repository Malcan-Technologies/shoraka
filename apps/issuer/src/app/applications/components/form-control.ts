"use client";

/** Imports
 *
 * What: Shared form control classnames and helpers.
 * Why: Business, Company, Contract, Invoice, and Review must share identical input/textarea/select styling.
 * Data: Exports Tailwind class strings and small helpers to compose error state classes.
 */
import { cn } from "@/lib/utils";

/** Helpers
 *
 * What: Canonical classes for form controls based on `branding.mdc` and screenshots.
 * Why: Prevent drift (thick borders, mixed radii, mismatched focus).
 * Data: Strings are used as `className` on shadcn/ui controls.
 */
export const formLabelClassName =
  "text-sm md:text-base leading-6 text-foreground";

export const formInputClassName =
  "h-11 w-full rounded-xl border border-input bg-background px-4 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export const formTextareaClassName =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export const formSelectTriggerClassName =
  "h-11 w-full rounded-xl border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Helpers
 *
 * What: Apply error styling consistently (thin red border).
 * Why: Images show a thin red border in error states; no thick outlines.
 * Data: `hasError` boolean toggles `border-destructive` only.
 */
export function withFieldError(className: string, hasError: boolean) {
  return cn(className, hasError ? "border-destructive" : null);
}

