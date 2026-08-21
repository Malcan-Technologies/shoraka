"use client";

import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import {
  PROSPECTUS_STEP_STATUS_LABEL,
  type ProspectusStepStatus,
} from "./completion";
import {
  PROSPECTUS_STATUS_BADGE_COMPACT_CLASS,
  PROSPECTUS_STATUS_BADGE_TONE,
} from "./status-badge-styles";

export { PROSPECTUS_STATUS_BADGE_COMPACT_CLASS } from "./status-badge-styles";

/** Compact status badge for workflow step navigation. */
export function ProspectusStatusBadge({
  status,
  className,
}: {
  status: ProspectusStepStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      label={PROSPECTUS_STEP_STATUS_LABEL[status]}
      status={PROSPECTUS_STATUS_BADGE_TONE[status]}
      data-prospectus-status={status}
      className={cn(PROSPECTUS_STATUS_BADGE_COMPACT_CLASS, className)}
    />
  );
}
