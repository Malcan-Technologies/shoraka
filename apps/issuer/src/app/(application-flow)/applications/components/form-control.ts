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

/** Same as autofill fix when the control uses muted surface (disabled / read-only), same as invoice locked row. */
export const formInputAutofillMutedChromeFix =
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--muted))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--muted-foreground))]";

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
 * What: Same fill + text as invoice locked table row (`applicationFlowLockedTableRowClassName`).
 * Why: One disabled look across every application-flow step.
 * Use: Add to Input/Textarea/Select className when disabled={true}.
 */
export const formInputDisabledClassName = cn(
  "bg-muted text-muted-foreground opacity-100 cursor-not-allowed disabled:opacity-100 disabled:bg-muted border-border shadow-none",
  formInputAutofillMutedChromeFix
);

/** Read-only uploaded file row / chip shell — same surface tokens as `formInputDisabledClassName` (no input-only autofill rules). */
export const formLockedFileSurfaceClassName =
  "bg-muted text-muted-foreground border-border shadow-none opacity-100";

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

/** Flagged row / field outside tables (chips, panels) — same primary tint + ring as table rows. */
export const applicationFlowAmendmentTargetSurfaceClassName = cn(
  "text-foreground",
  "bg-primary/[0.07] ring-1 ring-inset ring-primary/20 border-primary/30"
);

/** Section title (h2/h3) — contract-details pattern. */
export const applicationFlowSectionTitleClassName =
  "text-base font-semibold text-foreground";

/** Divider directly under a section title. */
export const applicationFlowSectionDividerClassName =
  "border-b border-border mt-2 mb-4";

/** Standard vertical + horizontal shell for long form steps (matches contract-details-step). */
export const applicationFlowStepOuterClassName = "space-y-10 px-3 w-full";

/** Horizontal inset only — selection steps without a long form stack. */
export const applicationFlowStepHorizontalClassName = "px-3 w-full";

/** Tight stack under a section title (title + fields). */
export const applicationFlowSectionStackClassName = "space-y-3";

/**
 * Label column next to h-11 inputs / radios (grid uses items-start; label mimics vertical center).
 */
export const applicationFlowLabelCellAlignInputClassName =
  "sm:min-h-11 sm:flex sm:items-center";

/** Label column next to textarea or tall upload blocks. */
export const applicationFlowLabelCellAlignTopClassName = "self-start pt-0.5";

/** Right column: yes/no radios aligned to same row height as a single-line input. */
export const applicationFlowRadioRowControlClassName = "h-11 flex items-center min-w-0";

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

export {
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
  fieldTooltipTriggerInputClassName,
} from "@cashsouk/ui";

/** Label + info icon gap (issuer application-flow forms). */
export const fieldTooltipLabelGap = "gap-1.5";

/** Label column + info icon row — same as contract-details-step; `justify-self-start` avoids stretched grid cells. */
export const fieldLabelWithTooltipRowClassName = cn(
  "flex min-h-11 w-fit max-w-full min-w-0 items-center justify-self-start",
  fieldTooltipLabelGap
);

