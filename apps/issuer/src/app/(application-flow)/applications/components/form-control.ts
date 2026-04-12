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

/** Chrome/Safari autofill uses a blue-tinted fill; map to design tokens (BRANDING / shadcn surfaces). */
export const formInputAutofillChromeFix =
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))]";

/** Same as autofill fix when the control uses muted surface (disabled / read-only). */
export const formInputAutofillMutedChromeFix =
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--muted))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))]";

export const formInputClassName = cn(
  "h-11 w-full rounded-xl border border-input bg-background px-4 text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary",
  formInputAutofillChromeFix
);

export const formTextareaClassName = cn(
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary",
  formInputAutofillChromeFix
);

export const formSelectTriggerClassName =
  "h-11 w-full rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-0 focus:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary";

/** Read-only / disabled field styling
 *
 * What: Grey background, readable text, no opacity fade.
 * Why: Locked amendment steps must show fields as locked without washing out the page.
 * Use: Add to Input/Textarea/Select className when disabled={true}.
 */
export const formInputDisabledClassName = cn(
  "bg-muted text-foreground opacity-100 cursor-not-allowed disabled:opacity-100 disabled:bg-muted border-border",
  formInputAutofillMutedChromeFix
);

/** Whole table row locked: tr + every td same muted fill (inputs also use formInputDisabledClassName). */
export const applicationFlowLockedTableRowClassName = cn(
  "bg-muted hover:bg-muted",
  "[&>td]:bg-muted",
  "text-muted-foreground"
);

/** Row must be fixed for amendment — same fill on all td, soft primary tint + inset ring. */
export const applicationFlowAmendmentTargetTableRowClassName = cn(
  "text-foreground",
  "bg-primary/[0.07] hover:bg-primary/[0.09] ring-1 ring-inset ring-primary/20",
  "[&>td]:bg-primary/[0.07] hover:[&>td]:bg-primary/[0.09]"
);

/** Full-width grid row (e.g. supporting documents) when uploads are locked in amendment mode. */
export const applicationFlowLockedSurfaceClassName =
  "rounded-xl border border-border/70 bg-muted/45";

/** Helpers
 *
 * What: Apply error styling consistently (thin red border, thick when focused).
 * Why: Error fields show thin red border normally, thick when focused for emphasis.
 * Data: `hasError` boolean toggles `border-destructive` and `border-2` on focus.
 */
export function withFieldError(className: string, hasError: boolean) {
  return cn(
    className,
    hasError ? "border-destructive focus-visible:border-2 focus-visible:border-destructive" : null
  );
}

/** Field-level tooltip styling — consistent across all steps.
 * Use: TooltipContent className, icon wrapper, label+icon gap.
 */
export const fieldTooltipContentClassName =
  "max-w-[240px] whitespace-pre-line bg-primary px-2 py-1.5 text-primary-foreground text-xs shadow-md";
export const fieldTooltipTriggerClassName =
  "p-1 text-muted-foreground cursor-help hover:text-foreground transition-colors";
export const fieldTooltipTriggerInputClassName =
  "absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground cursor-help hover:text-foreground transition-colors";
export const fieldTooltipLabelGap = "gap-1.5";

