"use client";

import { Badge } from "@/components/ui/badge";
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
    <Badge
      variant="outline"
      data-prospectus-status={status}
      className={cn(
        PROSPECTUS_STATUS_BADGE_COMPACT_CLASS,
        PROSPECTUS_STATUS_BADGE_TONE[status],
        className
      )}
    >
      {PROSPECTUS_STEP_STATUS_LABEL[status]}
    </Badge>
  );
}
