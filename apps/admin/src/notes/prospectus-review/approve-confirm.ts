/**
 * SECTION: Prospectus Approve confirmation copy and labels
 * WHY: Explicit dirty vs clean approve wording; no silent save
 */

export const PROSPECTUS_APPROVE_CONFIRM = {
  clean: {
    title: "Approve Prospectus?",
    description:
      "This will freeze the current saved Prospectus content for publication.",
    confirmLabel: "Approve",
  },
  dirty: {
    title: "Save changes and approve Prospectus?",
    description:
      "You have unsaved changes. Approving will save the current form values and approve this version of the Prospectus.",
    confirmLabel: "Save & Approve",
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
