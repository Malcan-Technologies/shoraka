import { isNoteProspectusPublished, type NoteDetail } from "@cashsouk/types";
import type { WorkflowStatusTone } from "@/notes/utils/workflow-status-tokens";
import type { StatusToken } from "@cashsouk/ui";

export type ProspectusNoteDetailPhase = "draft" | "ready" | "approved" | "published";

export type ProspectusStatusCardActionVariant = "default" | "outline";

export type ProspectusStatusCardModel = {
  phase: ProspectusNoteDetailPhase;
  heading: string;
  description: string;
  badgeLabel: "Draft" | "Ready for publish" | "Approved" | "Published";
  /** Opens the prospectus working area (`/notes/:id/prospectus`). */
  workspaceLabel: string;
  /** Frozen PDF exists after approval; opens in a new tab. */
  viewAvailable: boolean;
  /** Red alert card while Prospectus still needs approval. */
  emphasize: boolean;
  /** Draft = grey; Approved and Published = green. */
  badgeTone: WorkflowStatusTone;
  /** Primary (red) while action is required; outline when reviewing approved/published. */
  actionVariant: ProspectusStatusCardActionVariant;
};

/**
 * Admin portal semantic mapping for StatusBadge tokens.
 *
 * This card does NOT use `workflowToneToStatusToken`, because the prospectus
 * workflow meanings differ:
 * - "Ready for publish" is "active / purple" (non-final), not Draft/grey.
 */
export function resolveProspectusStatusCardBadgeToken(
  model: ProspectusStatusCardModel
): StatusToken {
  if (model.badgeLabel === "Draft") return "neutral";
  if (model.badgeLabel === "Ready for publish") return "active";
  if (model.badgeLabel === "Approved") return "action";
  if (model.badgeLabel === "Published") return "success";
  return "neutral";
}

/** Pure UI model for Admin Note Detail prospectus next-action card. */
export function resolveProspectusStatusCard(note: NoteDetail): ProspectusStatusCardModel {
  const notePublished = isNoteProspectusPublished({
    status: note.status,
    publishedAt: note.publishedAt,
  });
  const workflow = note.prospectus?.status;
  const display = note.prospectus?.displayStatus;

  if (notePublished || display === "Published") {
    return {
      phase: "published",
      heading: "Published",
      description: "The Note and its approved prospectus are now visible to investors.",
      badgeLabel: "Published",
      // Working area is read-only after listing; Edit would be misleading.
      workspaceLabel: "Open Review",
      viewAvailable: true,
      emphasize: false,
      badgeTone: "success",
      actionVariant: "outline",
    };
  }

  if (workflow === "APPROVED" || display === "Approved") {
    return {
      phase: "approved",
      heading: "Ready to publish",
      description: "The prospectus is approved and this Note is eligible for publication.",
      badgeLabel: "Approved",
      workspaceLabel: "Edit Prospectus",
      viewAvailable: true,
      emphasize: false,
      badgeTone: "success",
      actionVariant: "outline",
    };
  }

  if (workflow === "READY_FOR_PUBLISH" || display === "Ready for publish") {
    return {
      phase: "ready",
      heading: "Ready for publish",
      description:
        "The prospectus content has been reviewed. Listing Date and Closing Date will be populated when the Note is published.",
      badgeLabel: "Ready for publish",
      workspaceLabel: "Open Review",
      viewAvailable: false,
      emphasize: false,
      badgeTone: "neutral",
      actionVariant: "outline",
    };
  }

  // DRAFT, READY_FOR_REVIEW, missing review, or any pre-approval state.
  return {
    phase: "draft",
    heading: "Prospectus approval required",
    description: "Review and approve the prospectus before publishing this Note to the marketplace.",
    badgeLabel: "Draft",
    // Approval is the job; Edit undersells the gate.
    workspaceLabel: "Review Prospectus",
    viewAvailable: false,
    emphasize: true,
    badgeTone: "neutral",
    actionVariant: "default",
  };
}
