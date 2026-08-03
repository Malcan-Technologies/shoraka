"use client";

/**
 * Banner when a step is read-only during amendment (no remarks on this section).
 * Uses secondary (taupe) tokens so it reads clearly as “informational” vs primary “amendment required”.
 */

import { EyeIcon } from "@heroicons/react/24/outline";
import {
  AMENDMENT_CALLOUT_BODY,
  AMENDMENT_CALLOUT_CONTENT,
  AMENDMENT_CALLOUT_ICON_WRAP,
  AMENDMENT_CALLOUT_ROOT,
  AMENDMENT_CALLOUT_TITLE,
} from "./amendment-callout-styles";

export function ReadOnlyStepBanner() {
  return (
    <div
      className={`${AMENDMENT_CALLOUT_ROOT} border-status-neutral-text/30 bg-status-neutral-bg text-foreground`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${AMENDMENT_CALLOUT_ICON_WRAP} border-status-neutral-text/30 bg-status-neutral-bg`}
        aria-hidden
      >
        <EyeIcon className="h-5 w-5 text-status-neutral-text" />
      </div>
      <div className={AMENDMENT_CALLOUT_BODY}>
        <p className={`${AMENDMENT_CALLOUT_TITLE} text-foreground`}>
          This section is view only
        </p>
        <p className={`${AMENDMENT_CALLOUT_CONTENT} text-muted-foreground`}>
          The reviewer did not ask for changes in this section. Your saved answers are below for
          reference only. Press <span className="font-medium text-foreground">Continue</span>{" "}
          to move to the next amended step you have not acknowledged yet, or use the stepper to open a
          specific step that needs changes.
        </p>
      </div>
    </div>
  );
}
