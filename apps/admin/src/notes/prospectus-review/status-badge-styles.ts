import { WORKFLOW_STATUS_BADGE } from "@/notes/utils/workflow-status-tokens";
import type { ProspectusStepStatus } from "./completion";

export const PROSPECTUS_STATUS_BADGE_COMPACT_CLASS =
  "h-5 shrink-0 px-1.5 py-0 text-[10px] font-medium leading-none shadow-none";

export const PROSPECTUS_STATUS_BADGE_TONE: Record<ProspectusStepStatus, string> = {
  complete: WORKFLOW_STATUS_BADGE.success.badgeClass,
  required: WORKFLOW_STATUS_BADGE.warning.badgeClass,
  optional: WORKFLOW_STATUS_BADGE.neutral.badgeClass,
};
