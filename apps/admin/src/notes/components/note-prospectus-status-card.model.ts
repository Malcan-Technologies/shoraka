import type { NoteDetail } from "@cashsouk/types";
import type { WorkflowStatusTone } from "@/notes/utils/workflow-status-tokens";

export type ProspectusNoteDetailPhase = "draft" | "approved" | "published";

export type ProspectusStatusCardActionVariant = "default" | "outline";

export type ProspectusStatusCardModel = {
  phase: ProspectusNoteDetailPhase;
  heading: string;
  description: string;
  badgeLabel: "Draft" | "Approved" | "Published";
  primaryLabel: string;
  secondaryLabel: string | null;
  /** Red alert card while Prospectus still needs approval. */
  emphasize: boolean;
  /**
   * Extra workflow badge tone. Only Approved uses success (green).
   * Draft / Published / others stay null → original plain outline Badge.
   */
  badgeTone: WorkflowStatusTone | null;
  /** Primary (red) while action is required; outline when reviewing approved/published. */
  actionVariant: ProspectusStatusCardActionVariant;
};

/** Pure UI model for Admin Note Detail prospectus next-action card. */
export function resolveProspectusStatusCard(note: NoteDetail): ProspectusStatusCardModel {
  const notePublished = note.status === "PUBLISHED" || Boolean(note.publishedAt);
  const workflow = note.prospectus?.status;
  const display = note.prospectus?.displayStatus;

  if (notePublished || workflow === "PUBLISHED" || display === "Published") {
    return {
      phase: "published",
      heading: "Published",
      description: "The Note and its approved prospectus are now visible to investors.",
      badgeLabel: "Published",
      primaryLabel: "View Prospectus",
      secondaryLabel: null,
      // Neutral card — primary/red tint is reserved for genuine warning/error surfaces.
      emphasize: false,
      badgeTone: null,
      actionVariant: "outline",
    };
  }

  if (workflow === "APPROVED" || display === "Approved") {
    return {
      phase: "approved",
      heading: "Ready to publish",
      description: "The prospectus is approved and this Note is eligible for publication.",
      badgeLabel: "Approved",
      primaryLabel: "Review Prospectus",
      secondaryLabel: null,
      // Ready state uses the default Note card surface — not primary/error emphasis.
      emphasize: false,
    };
  }

  // DRAFT, READY_FOR_REVIEW, missing review, or any pre-approval state.
  return {
    phase: "draft",
    heading: "Prospectus approval required",
    description: "Review and approve the prospectus before publishing this Note to the marketplace.",
    badgeLabel: "Draft",
    primaryLabel: "Review Prospectus",
    secondaryLabel: null,
    emphasize: false,
  };
}
