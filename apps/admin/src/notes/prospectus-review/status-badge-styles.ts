import type { StatusToken } from "@cashsouk/ui";
import type { ProspectusStepStatus } from "./completion";

export const PROSPECTUS_STATUS_BADGE_COMPACT_CLASS =
  "h-5 shrink-0 px-1.5 py-0 text-meta font-normal leading-none shadow-none";

export const PROSPECTUS_STATUS_BADGE_TONE: Record<ProspectusStepStatus, StatusToken> = {
  complete: "success",
  required: "action",
  optional: "neutral",
};
