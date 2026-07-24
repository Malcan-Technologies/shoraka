import type { ComponentType } from "react";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import type { ProspectusWorkflowStepId } from "./labels";

export const PROSPECTUS_STEP_ICONS: Record<
  ProspectusWorkflowStepId,
  ComponentType<{ className?: string }>
> = {
  0: DocumentTextIcon,
  1: BuildingOffice2Icon,
  2: BanknotesIcon,
  3: EyeIcon,
};

export const PROSPECTUS_STEP_ICON_NAMES: Record<ProspectusWorkflowStepId, string> = {
  0: "DocumentTextIcon",
  1: "BuildingOffice2Icon",
  2: "BanknotesIcon",
  3: "EyeIcon",
};

export const PROSPECTUS_STEP_ICON_CLASS = "h-5 w-5 shrink-0 text-primary";

export const PROSPECTUS_STEPS_GRID_CLASS =
  "grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]";

export const PROSPECTUS_ACTIVE_COLUMN_CLASS = "flex min-w-0 flex-col gap-4";
