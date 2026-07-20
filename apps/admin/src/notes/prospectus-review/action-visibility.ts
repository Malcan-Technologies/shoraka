import {
  normalizeProspectusWorkflowStatus,
  type ProspectusReviewStatus,
} from "@cashsouk/types";
import type { ProspectusWorkflowStepId } from "./labels";

export type ProspectusActionVisibility = {
  saveDraft: boolean;
  saveAndPreview: boolean;
  approve: boolean;
  viewProspectus: boolean;
  backToNote: boolean;
};

/**
 * Action bar visibility for Draft → Approved → Published (no submit/reopen).
 */
export function getProspectusActionVisibility(input: {
  step: ProspectusWorkflowStepId;
  status: ProspectusReviewStatus;
  canManage: boolean;
  notePublished: boolean;
}): ProspectusActionVisibility {
  const workflow = normalizeProspectusWorkflowStatus(input.status);
  const published = input.notePublished || workflow === "PUBLISHED";
  const canEdit = input.canManage && !published;

  return {
    saveDraft: canEdit,
    saveAndPreview: canEdit,
    approve: canEdit && (workflow === "DRAFT" || workflow === "APPROVED"),
    viewProspectus: published,
    backToNote: workflow === "APPROVED" || published,
  };
}
