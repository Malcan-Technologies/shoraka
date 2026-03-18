/**
 * Shared input styling for product workflow builder.
 * Normalizes Input, Textarea, Select across step configs.
 * Matches application flow and BRANDING.md.
 */

import { cn } from "@/lib/utils";

/** Override: focus on border, no ring. Uses ring token (brand red lightened) per branding.mdc. */
export const INPUT_CLASS = "py-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-ring";

/** Error state: destructive border, thicker on focus. */
export const INPUT_ERROR_CLASS = "border-destructive focus-visible:border-2 focus-visible:border-destructive";

/** Input with optional error. Use: cn(INPUT_CLASS, hasError && INPUT_ERROR_CLASS, className). */
export function inputClass(hasError?: boolean, className?: string): string {
  return cn(INPUT_CLASS, hasError && INPUT_ERROR_CLASS, className);
}

/** Textarea: min-height, resize. Focus on border. */
export const TEXTAREA_CLASS = "min-h-[80px] resize-y py-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-ring";

/** Select trigger: height matches Input, focus on border. */
export const SELECT_TRIGGER_CLASS = "h-9 focus:outline-none focus:ring-0 focus:border-ring focus-visible:outline-none focus-visible:ring-0 focus-visible:border-ring";

/** Field group: label + input. */
export const FIELD_GAP = "gap-2";

/** Section: between field groups. */
export const SECTION_GAP = "gap-4";

/** Category/section header: matches application flow (text-base font-semibold, border-b). */
export const SECTION_HEADER_CLASS = "text-base font-semibold text-foreground";
export const SECTION_HEADER_DIVIDER_CLASS = "border-b border-border mt-2 mb-4";
