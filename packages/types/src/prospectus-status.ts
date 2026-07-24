/**
 * SECTION: Prospectus workflow display status helpers
 * WHY: One authoritative mapping for Admin/Investor — Draft | Approved | Published only
 */

export type ProspectusReviewStatusRaw =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SUPERSEDED"
  | "PUBLISHED";

/** Active workflow statuses written by the simplified flow. */
export type ProspectusWorkflowStatus = "DRAFT" | "APPROVED" | "PUBLISHED";

export type ProspectusDisplayStatus = "Draft" | "Approved" | "Published";

/**
 * Legacy READY_FOR_REVIEW / SUPERSEDED → DRAFT (must re-approve).
 * Never expose legacy labels in UI.
 */
export function normalizeProspectusWorkflowStatus(
  raw: string | null | undefined
): ProspectusWorkflowStatus {
  if (raw === "PUBLISHED") return "PUBLISHED";
  if (raw === "APPROVED") return "APPROVED";
  return "DRAFT";
}

/**
 * User-facing status. Note and Prospectus must not drift after a successful publish
 * transaction; if they disagree, prefer not treating as Published for investors.
 */
export function getProspectusDisplayStatus(input: {
  reviewStatus: string | null | undefined;
  notePublished: boolean;
}): ProspectusDisplayStatus {
  const workflow = normalizeProspectusWorkflowStatus(input.reviewStatus);
  if (workflow === "PUBLISHED" && input.notePublished) return "Published";
  if (workflow === "PUBLISHED" && !input.notePublished) return "Approved";
  if (workflow === "APPROVED" && input.notePublished) return "Published";
  if (workflow === "APPROVED") return "Approved";
  return "Draft";
}

export function formatProspectusListBadge(display: ProspectusDisplayStatus): string {
  return `Prospectus ${display}`;
}
