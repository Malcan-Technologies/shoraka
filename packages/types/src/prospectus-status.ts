/**
 * SECTION: Prospectus workflow display status helpers
 * WHY: One authoritative mapping for Admin/Investor — Draft | Approved | Published only
 */

export type ProspectusReviewStatusRaw =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "READY_FOR_PUBLISH"
  | "APPROVED"
  | "SUPERSEDED"
  | "PUBLISHED";

/** Active workflow statuses written by the simplified flow. */
export type ProspectusWorkflowStatus = "DRAFT" | "READY_FOR_PUBLISH" | "APPROVED" | "PUBLISHED";

export type ProspectusDisplayStatus =
  | "Draft"
  | "Ready for publish"
  | "Approved"
  | "Published";

/**
 * Prospectus lock/display: the note completed marketplace publish and was not unpublished.
 * Funding close / servicing move `status` off PUBLISHED but `publishedAt` stays set.
 * Unpublish returns to DRAFT and clears `publishedAt` — that is the only reopen path.
 */
export function isNoteProspectusPublished(note: {
  status: string | null | undefined;
  publishedAt: string | Date | null | undefined;
}): boolean {
  if (note.publishedAt == null || note.publishedAt === "") return false;
  return note.status !== "DRAFT";
}

/**
 * Legacy READY_FOR_REVIEW / SUPERSEDED → DRAFT (must re-approve).
 * Never expose legacy labels in UI.
 */
export function normalizeProspectusWorkflowStatus(
  raw: string | null | undefined
): ProspectusWorkflowStatus {
  if (raw === "PUBLISHED") return "PUBLISHED";
  if (raw === "APPROVED") return "APPROVED";
  if (raw === "READY_FOR_PUBLISH") return "READY_FOR_PUBLISH";
  return "DRAFT";
}

/**
 * User-facing status. Note and Prospectus must not drift after a successful publish
 * transaction; if they disagree, prefer not treating as Published for investors.
 * Unlisted leftover PUBLISHED (after unpublish) displays as Draft — re-approval is required.
 */
export function getProspectusDisplayStatus(input: {
  reviewStatus: string | null | undefined;
  notePublished: boolean;
}): ProspectusDisplayStatus {
  const workflow = normalizeProspectusWorkflowStatus(input.reviewStatus);
  if (workflow === "PUBLISHED" && input.notePublished) return "Published";
  if (workflow === "APPROVED" && input.notePublished) return "Published";
  if (workflow === "READY_FOR_PUBLISH" && input.notePublished) return "Published";
  if (workflow === "APPROVED") return "Approved";
  if (workflow === "READY_FOR_PUBLISH") return "Ready for publish";
  return "Draft";
}

export function formatProspectusListBadge(display: ProspectusDisplayStatus): string {
  return `Prospectus ${display}`;
}
