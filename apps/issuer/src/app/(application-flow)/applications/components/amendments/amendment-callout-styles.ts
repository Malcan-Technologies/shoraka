/**
 * Shared layout + typography for AmendmentRemarkCard and ReadOnlyStepBanner.
 * Only semantic colors (primary / secondary) differ on the outer shell and title.
 */

export const AMENDMENT_CALLOUT_ROOT =
  "rounded-xl border-2 shadow-sm p-4 sm:p-5 flex gap-3 sm:gap-4 items-start";

export const AMENDMENT_CALLOUT_ICON_WRAP =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2";

export const AMENDMENT_CALLOUT_BODY = "min-w-0 flex flex-col gap-2 pt-0.5";

export const AMENDMENT_CALLOUT_TITLE =
  "font-semibold text-ui sm:text-base leading-snug tracking-tight";

export const AMENDMENT_CALLOUT_CONTENT =
  "text-sm sm:text-ui leading-6 sm:leading-7";

/** Compact remark list under a flagged field (row already carries amendment tint). */
export const AMENDMENT_INLINE_FEEDBACK_LIST = "text-xs leading-5 text-foreground";
