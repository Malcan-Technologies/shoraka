/**
 * SECTION: Prospectus Approve confirmation copy and labels
 * WHY: Explicit dirty vs clean approve wording; no silent save
 */

export const PROSPECTUS_APPROVE_CONFIRM = {
  clean: {
    title: "Mark Prospectus Ready for Publish?",
    description:
      "This will lock the current saved Prospectus content. The final PDF will be generated when you publish the Note.",
    confirmLabel: "Mark Ready",
  },
  dirty: {
    title: "Save changes and mark Ready for Publish?",
    description:
      "You have unsaved changes. Marking Ready will save the current form values and lock this version of the Prospectus content.",
    confirmLabel: "Save & Mark Ready",
  },
} as const;

export type ProspectusApproveConfirmCopy =
  (typeof PROSPECTUS_APPROVE_CONFIRM)[keyof typeof PROSPECTUS_APPROVE_CONFIRM];

export type ProspectusApprovePhase = "idle" | "saving" | "approving";

export function getProspectusApproveConfirmCopy(
  dirty: boolean
): ProspectusApproveConfirmCopy {
  return dirty ? PROSPECTUS_APPROVE_CONFIRM.dirty : PROSPECTUS_APPROVE_CONFIRM.clean;
}

export function prospectusApprovePrimaryLabel(
  dirty: boolean,
  phase: ProspectusApprovePhase
): string {
  if (phase === "saving") return "Saving…";
  if (phase === "approving") return "Approving…";
  return getProspectusApproveConfirmCopy(dirty).confirmLabel;
}
