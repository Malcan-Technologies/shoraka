import type { NoteDetail } from "@cashsouk/types";
import type { WorkflowStatusTone } from "@/notes/utils/workflow-status-tokens";

export type ProspectusNoteDetailPhase = "draft" | "approved" | "published";

export type ProspectusStatusCardActionVariant = "default" | "outline";

export type ProspectusStatusCardModel = {
  phase: ProspectusNoteDetailPhase;
  heading: string;
  description: string;
  badgeLabel: "Draft" | "Approved" | "Published";
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

/** Pure UI model for Admin Note Detail prospectus next-action card. */
export function resolveProspectusStatusCard(note: NoteDetail): ProspectusStatusCardModel {
  const notePublished = note.status === "PUBLISHED";
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
