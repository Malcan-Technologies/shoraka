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
      className={`${AMENDMENT_CALLOUT_ROOT} border-secondary/45 bg-secondary/20 text-secondary-foreground`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${AMENDMENT_CALLOUT_ICON_WRAP} bg-secondary/35 border-secondary/55`}
        aria-hidden
      >
        <EyeIcon className="h-5 w-5 text-secondary-foreground" />
      </div>
      <div className={AMENDMENT_CALLOUT_BODY}>
        <p className={`${AMENDMENT_CALLOUT_TITLE} text-secondary-foreground`}>
          This section is view only
        </p>
        <p className={`${AMENDMENT_CALLOUT_CONTENT} text-secondary-foreground/90`}>
          The reviewer did not ask for changes in this section. Your saved answers are below for
          reference only. Press <span className="font-medium text-secondary-foreground">Continue</span>{" "}
          to move to the next amended step you have not acknowledged yet, or use the stepper to open a
          specific step that needs changes.
        </p>
      </div>
    </div>
  );
}
