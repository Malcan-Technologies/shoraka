"use client";

/**
 * Banner shown when a step is read-only during amendment flow (no amendments requested).
 * Mirrors AmendmentRemarkCard layout but uses secondary/taupe tones for informational state.
 */

import { EyeIcon } from "@heroicons/react/24/outline";

export function ReadOnlyStepBanner() {
  return (
    <div className="mb-6 rounded-xl border border-border bg-secondary/10 p-4 flex gap-3">
      <EyeIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      <div>
        <h4 className="font-semibold text-foreground">View only</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          No amendments requested for this section. Use the stepper to jump to sections that need changes.
        </p>
      </div>
    </div>
  );
}
