import type { NoteDetail, WithdrawalInstruction } from "@cashsouk/types";
import { isNoteLifecycleVisuallyComplete } from "@/notes/utils/settlement-trustee-workflow";

export type NoteLifecycleAction = "publish" | "unpublish" | "closeFunding" | "failFunding";

export type NoteLifecycleActionConfig = {
  key: NoteLifecycleAction;
  label: string;
  variant: "default" | "outline" | "secondary" | "destructive";
  helper?: string;
};

export type NoteLifecycleActionPlan = {
  primary: NoteLifecycleActionConfig | null;
  secondary: NoteLifecycleActionConfig[];
  contextHelper: string | null;
  meetsMinimumFunding: boolean;
  isFundingOpen: boolean;
};

export type NoteLifecycleTerminalFailure = {
  label: string;
  description: string;
  stageIndex: number;
};

export function findIssuerDisbursementWithdrawal(note: NoteDetail): WithdrawalInstruction | null {
  return (
    (note.withdrawals ?? []).find(
      (withdrawal) =>
        withdrawal.withdrawalType === "ISSUER_DISBURSEMENT" && withdrawal.status !== "CANCELLED"
    ) ?? null
  );
}

export function isDisbursementComplete(withdrawal: WithdrawalInstruction | null): boolean {
  return withdrawal?.status === "COMPLETED";
}

/** Index into the six lifecycle stages (Draft → Repaid). */
export function getNoteLifecycleStageIndex(note: NoteDetail): number {
  if (isNoteLifecycleVisuallyComplete(note)) {
    return 5;
  }
  const servicingActive =
    note.status === "ACTIVE" ||
    note.status === "ARREARS" ||
    note.status === "DEFAULTED" ||
    note.servicingStatus === "CURRENT" ||
    note.servicingStatus === "LATE" ||
    note.servicingStatus === "ARREARS" ||
    note.servicingStatus === "DEFAULTED";
  if (servicingActive) {
    return 4;
  }
  if (note.fundingStatus === "FUNDED") {
    return isDisbursementComplete(findIssuerDisbursementWithdrawal(note)) ? 4 : 3;
  }
  if (note.status === "FUNDING") {
    return 2;
  }
  if (note.status === "PUBLISHED") {
    return 1;
  }
  return 0;
}

function firstMatchingEventAt(note: NoteDetail, eventTypes: string[]): string | null {
  const match = note.events?.find((event) => eventTypes.includes(event.eventType));
  if (!match?.createdAt) return null;
  return Number.isFinite(new Date(match.createdAt).getTime()) ? match.createdAt : null;
}

function validTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  return Number.isFinite(new Date(value).getTime()) ? value : null;
}

/** When each lifecycle milestone was reached. Null until that stage is completed. */
export function getNoteLifecycleStageCompletedAt(
  note: NoteDetail,
  stageId: "DRAFT" | "PUBLISHED" | "FUNDED" | "DISBURSEMENT" | "ACTIVE" | "REPAID"
): string | null {
  switch (stageId) {
    case "DRAFT":
      return validTimestamp(note.createdAt);
    case "PUBLISHED":
      return (
        validTimestamp(note.publishedAt) ??
        validTimestamp(note.listing?.publishedAt) ??
        firstMatchingEventAt(note, ["PUBLISH", "NOTE_PUBLISHED"])
      );
    case "FUNDED":
      return (
        validTimestamp(note.fundingClosedAt) ??
        firstMatchingEventAt(note, ["CLOSE_FUNDING", "NOTE_FUNDING_CLOSED"])
      );
    case "DISBURSEMENT":
      return validTimestamp(findIssuerDisbursementWithdrawal(note)?.completedAt);
    case "ACTIVE":
      return validTimestamp(note.activatedAt) ?? firstMatchingEventAt(note, ["ACTIVATE", "NOTE_ACTIVATED"]);
    case "REPAID":
      return validTimestamp(note.repaidAt);
  }
}

export function getNoteLifecycleTerminalFailure(
  note: NoteDetail,
  activeIndex: number
): NoteLifecycleTerminalFailure | null {
  if (note.status === "FAILED_FUNDING" || note.fundingStatus === "FAILED") {
    return {
      label: "Funding failed",
      description:
        "Marketplace did not reach the minimum funding threshold. Commitments must be released.",
      stageIndex: 1,
    };
  }
  if (note.status === "CANCELLED") {
    return {
      label: "Cancelled",
      description: "This note has been cancelled and is no longer active.",
      stageIndex: activeIndex,
    };
  }
  if (note.status === "DEFAULTED") {
    return {
      label: "Defaulted",
      description:
        "Servicing has reached default. Settle outstanding obligations via the servicing panel.",
      stageIndex: 4,
    };
  }
  return null;
}

export function buildNoteLifecycleActionPlan(note: NoteDetail): NoteLifecycleActionPlan {
  const publishableListingStatuses = ["NOT_LISTED", "DRAFT", "UNPUBLISHED"];
  const prospectusApproved =
    note.prospectus?.status === "APPROVED" || note.prospectus?.status === "PUBLISHED";
  const baseCanPublish =
    note.status === "DRAFT" &&
    note.fundingStatus === "NOT_OPEN" &&
    publishableListingStatuses.includes(note.listingStatus);
  const canPublish = baseCanPublish && prospectusApproved;
  const isFundingOpen = note.status === "PUBLISHED" && note.fundingStatus === "OPEN";
  const meetsMinimumFunding = note.fundingPercent + 0.005 >= note.minimumFundingPercent;
  const canUnpublish =
    note.status === "PUBLISHED" &&
    note.listingStatus === "PUBLISHED" &&
    note.fundingStatus === "OPEN" &&
    note.investments.length === 0;
  const canCloseFunding = isFundingOpen && meetsMinimumFunding;
  const canFailFunding = isFundingOpen && !meetsMinimumFunding;

  let primary: NoteLifecycleActionConfig | null = null;
  const secondary: NoteLifecycleActionConfig[] = [];
  let contextHelper: string | null = null;

  // Draft prospectus: next action lives on NoteProspectusStatusCard (not here).
  if (canPublish) {
    primary = {
      key: "publish",
      label: "Publish to Marketplace",
      variant: "default",
      helper: "Prospectus approved. Publish when you are ready to list this Note.",
    };
  } else if (canCloseFunding) {
    primary = {
      key: "closeFunding",
      label: "Close Funding",
      variant: "default",
      helper: `Minimum funding reached (${note.fundingPercent.toFixed(1)}% of target). Closing locks allocations and activates servicing in a single step.`,
    };
    if (canUnpublish) {
      secondary.push({ key: "unpublish", label: "Unpublish", variant: "outline" });
    }
  } else if (note.status === "ACTIVE" || note.servicingStatus !== "NOT_STARTED") {
    contextHelper = "Servicing is active. Manage receipts and settlement in the Servicing tab.";
  } else if (note.status === "PUBLISHED" || note.status === "FUNDING") {
    contextHelper = isFundingOpen
      ? canFailFunding
        ? `Awaiting investor commitments. Minimum ${note.minimumFundingPercent}% not yet met (currently ${note.fundingPercent.toFixed(1)}%).`
        : "Awaiting investor commitments."
      : "Awaiting funding to open.";
    if (canFailFunding) {
      secondary.push({
        key: "failFunding",
        label: "Fail Funding",
        variant: "secondary",
      });
    }
    if (canUnpublish) {
      secondary.push({ key: "unpublish", label: "Unpublish", variant: "outline" });
    }
  }

  return { primary, secondary, contextHelper, meetsMinimumFunding, isFundingOpen };
}

/**
 * Primary lifecycle buttons the admin must take now: publish or close funding.
 * Fail funding is supplementary while the listing waits on investors.
 */
const LIFECYCLE_ADMIN_ACTIONS: readonly NoteLifecycleAction[] = ["publish", "closeFunding"];

/** True when Overview should highlight Lifecycle for a primary admin action. */
export function hasNoteLifecycleAdminAction(note: NoteDetail): boolean {
  if (isNoteLifecycleVisuallyComplete(note)) return false;
  if (getNoteLifecycleTerminalFailure(note, getNoteLifecycleStageIndex(note)) != null) return false;
  const primary = buildNoteLifecycleActionPlan(note).primary;
  return primary != null && LIFECYCLE_ADMIN_ACTIONS.includes(primary.key);
}

export type NoteLifecycleCardTone = "action" | "waiting";

/** Yellow while CashSouk must act; blue while a published listing waits on investors. */
export function getNoteLifecycleCardTone(note: NoteDetail): NoteLifecycleCardTone | null {
  if (hasNoteLifecycleAdminAction(note)) return "action";
  if (note.status === "PUBLISHED") return "waiting";
  return null;
}
