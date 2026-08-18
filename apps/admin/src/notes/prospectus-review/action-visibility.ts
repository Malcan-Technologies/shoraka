import {
  normalizeProspectusWorkflowStatus,
  type ProspectusReviewStatus,
} from "@cashsouk/types";
import type { ProspectusWorkflowStepId } from "./labels";

export type ProspectusActionVisibility = {
  saveDraft: boolean;
  preview: boolean;
  approve: boolean;
  viewProspectus: boolean;
  backToNote: boolean;
};

/**
 * Action bar visibility for Draft → Approved → Published (no submit/reopen).
 * Approve is Draft-only — completeness may disable the button, but never show it when already APPROVED.
 */
export function getProspectusActionVisibility(input: {
  step: ProspectusWorkflowStepId;
  status: ProspectusReviewStatus;
  canManage: boolean;
  notePublished: boolean;
}): ProspectusActionVisibility {
  const workflow = normalizeProspectusWorkflowStatus(input.status);
  const listed = input.notePublished;
  const effective = !listed && workflow === "PUBLISHED" ? "DRAFT" : workflow;
  const freezeReady = effective === "APPROVED" || listed;
  const canEdit = input.canManage && !listed;

  return {
    saveDraft: canEdit,
    preview: canEdit,
    approve: canEdit && effective === "DRAFT",
    viewProspectus: freezeReady && effective !== "DRAFT",
    backToNote: freezeReady || listed,
  };
}
