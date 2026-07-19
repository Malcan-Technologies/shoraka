import type { ComponentType } from "react";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  EyeIcon,
  LightBulbIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import type { ProspectusWorkflowStepId } from "./labels";

/** Icon component per active step — matches Application Review card title treatment. */
export const PROSPECTUS_STEP_ICONS: Record<
  ProspectusWorkflowStepId,
  ComponentType<{ className?: string }>
> = {
  0: DocumentTextIcon,
  1: StarIcon,
  2: BuildingOffice2Icon,
  3: ClipboardDocumentCheckIcon,
  4: BanknotesIcon,
  5: LightBulbIcon,
  6: EyeIcon,
};

/** Stable names for unit tests (no JSX). */
export const PROSPECTUS_STEP_ICON_NAMES: Record<ProspectusWorkflowStepId, string> = {
  0: "DocumentTextIcon",
  1: "StarIcon",
  2: "BuildingOffice2Icon",
  3: "ClipboardDocumentCheckIcon",
  4: "BanknotesIcon",
  5: "LightBulbIcon",
  6: "EyeIcon",
};

/** Same classes as Application Review `ReviewSectionCard` title icons. */
export const PROSPECTUS_STEP_ICON_CLASS = "h-5 w-5 shrink-0 text-primary";

/** Desktop steps + active-step grid: top-align cards in one row. */
export const PROSPECTUS_STEPS_GRID_CLASS =
  "grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]";

/**
 * Right column uses flex gap (not space-y) so a `lg:hidden` Select does not
 * add top margin to the active-step card on desktop.
 */
export const PROSPECTUS_ACTIVE_COLUMN_CLASS = "flex min-w-0 flex-col gap-4";
