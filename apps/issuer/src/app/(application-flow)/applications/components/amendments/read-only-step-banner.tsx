"use client";

/**
 * Banner when a step is read-only during amendment (no remarks on this section).
 * Uses secondary (taupe) tokens so it reads clearly as “informational” vs primary “amendment required”.
 */

import { EyeIcon } from "@heroicons/react/24/outline";

export function ReadOnlyStepBanner() {
  return (
    <div
      className="rounded-xl border-2 border-secondary/45 bg-secondary/20 text-secondary-foreground shadow-sm p-4 sm:p-5 flex gap-3 sm:gap-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/35 border-2 border-secondary/55"
        aria-hidden
      >
        <EyeIcon className="h-5 w-5 text-secondary-foreground" />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold text-secondary-foreground text-[15px] sm:text-base leading-snug tracking-tight">
          This section is view only
        </p>
        <p className="mt-2 text-sm sm:text-[15px] text-secondary-foreground/90 leading-6 sm:leading-7">
          The reviewer did not request changes here. You can read your saved answers below. Use the
          stepper above to open a step marked for amendment, or continue to move to the next step
          that needs your attention.
        </p>
      </div>
    </div>
  );
}
