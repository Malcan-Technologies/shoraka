import type { ProspectusReviewStatus } from "@cashsouk/types";
import type { ProspectusWorkflowStepId } from "./labels";

export type ProspectusActionVisibility = {
  saveDraft: boolean;
  preview: boolean;
  submitForReview: boolean;
  approve: boolean;
  reopen: boolean;
  backToNote: boolean;
};

/**
 * Action bar visibility by review status and current step.
 * Submit / Approve / Reopen are final-step only. Does not change API rules.
 */
export function getProspectusActionVisibility(input: {
  step: ProspectusWorkflowStepId;
  status: ProspectusReviewStatus;
  canManage: boolean;
  notePublished: boolean;
}): ProspectusActionVisibility {
  const isFinalStep = input.step === 6;
  const locked = input.status === "APPROVED";
  const canEdit = input.canManage && !locked;

  return {
    saveDraft: canEdit,
    preview: true,
    submitForReview: canEdit && input.status === "DRAFT" && isFinalStep,
    approve: canEdit && input.status === "READY_FOR_REVIEW" && isFinalStep,
    reopen: input.canManage && locked && !input.notePublished && isFinalStep,
    backToNote: input.status === "APPROVED",
  };
}
