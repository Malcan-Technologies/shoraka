import type { NoteDetail, WithdrawalInstruction } from "@cashsouk/types";
import {
  isNoteLifecycleVisuallyComplete,
  isSettlementWrappingUp,
} from "@/notes/utils/settlement-trustee-workflow";

export type NoteLifecycleStageId =
  | "DRAFT"
  | "PUBLISHED"
  | "FUNDED"
  | "DISBURSEMENT"
  | "ACTIVE"
  | "SETTLEMENT"
  | "REPAID";

export const NOTE_LIFECYCLE_STAGES: { id: NoteLifecycleStageId; label: string }[] = [
  { id: "DRAFT", label: "Draft" },
  { id: "PUBLISHED", label: "Published" },
  { id: "FUNDED", label: "Funded" },
  { id: "DISBURSEMENT", label: "Disbursement" },
  { id: "ACTIVE", label: "Active" },
  { id: "SETTLEMENT", label: "Settlement" },
  { id: "REPAID", label: "Complete" },
];

export type NoteLifecycleAction =
  | "publish"
  | "unpublish"
  | "pauseListing"
  | "resumeListing"
  | "closeFunding"
  | "failFunding";

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
  isListingLive: boolean;
  isListingPaused: boolean;
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

function getSettlementAmount(note: NoteDetail): number {
  return note.settlementAmount ?? note.invoiceAmount ?? note.requestedAmount ?? 0;
}

function settlementReceiptThresholdMet(note: NoteDetail): boolean {
  const settlementAmount = getSettlementAmount(note);
  if (settlementAmount <= 0.005) return false;
  const payments = note.payments ?? [];
  if (payments.some((payment) => payment.status === "PENDING")) return false;
  const eligibleReceiptTotal = payments
    .filter((payment) =>
      ["RECEIVED", "RECONCILED", "PARTIAL", "SETTLED"].includes(payment.status)
    )
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);
  const settledReceiptTotal = payments
    .filter((payment) => payment.status === "SETTLED")
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);
  return (
    eligibleReceiptTotal + 0.005 >= settlementAmount ||
    settledReceiptTotal + 0.005 >= settlementAmount
  );
}

function hasActiveSettlementWork(note: NoteDetail): boolean {
  return (note.settlements ?? []).some(
    (settlement) =>
      settlement.status === "PREVIEW" ||
      settlement.status === "APPROVED" ||
      settlement.status === "POSTED"
  );
}

/** True while settlement is the current lifecycle stage (Active → Complete). */
export function isNoteSettlementStageCurrent(note: NoteDetail): boolean {
  if (isNoteLifecycleVisuallyComplete(note)) return false;
  return (
    hasActiveSettlementWork(note) ||
    isSettlementWrappingUp(note) ||
    settlementReceiptThresholdMet(note)
  );
}

/** Index into the seven lifecycle stages (Draft → Complete). */
export function getNoteLifecycleStageIndex(note: NoteDetail): number {
  if (isNoteLifecycleVisuallyComplete(note)) {
    return 6;
  }
  if (isNoteSettlementStageCurrent(note)) {
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
  stageId: NoteLifecycleStageId
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
    case "SETTLEMENT": {
      const postedAt = (note.settlements ?? [])
        .map((settlement) =>
          settlement.status === "POSTED" ? validTimestamp(settlement.postedAt) : null
        )
        .filter((value): value is string => value != null)
        .sort()[0];
      return postedAt ?? null;
    }
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
      stageIndex: isNoteSettlementStageCurrent(note) ? 5 : 4,
    };
  }
  return null;
}

/** True while the note is live on the investor marketplace. */
export function isNoteMarketplaceListingLive(note: NoteDetail): boolean {
  return (
    note.status === "PUBLISHED" &&
    note.listingStatus === "PUBLISHED" &&
    note.fundingStatus === "OPEN"
  );
}

/** Matches the API: only published listings that are still open for funding can be featured. */
export function isNoteFeatureEligible(note: NoteDetail): boolean {
  return isNoteMarketplaceListingLive(note);
}

export function buildNoteLifecycleActionPlan(note: NoteDetail): NoteLifecycleActionPlan {
  const publishableListingStatuses = ["NOT_LISTED", "DRAFT", "UNPUBLISHED"];
  const prospectusApproved = note.prospectus?.status === "APPROVED";
  const baseCanPublish =
    note.status === "DRAFT" &&
    note.fundingStatus === "NOT_OPEN" &&
    publishableListingStatuses.includes(note.listingStatus);
  const canPublish = baseCanPublish && prospectusApproved;
  const isFundingOpen = note.status === "PUBLISHED" && note.fundingStatus === "OPEN";
  const isListingLive = isNoteMarketplaceListingLive(note);
  const isListingPaused = isFundingOpen && note.listingStatus === "UNPUBLISHED";
  const hasCommitments = note.investments.length > 0;
  const meetsMinimumFunding = note.fundingPercent + 0.005 >= note.minimumFundingPercent;
  const canUnpublish = isListingLive && !hasCommitments;
  const canPauseListing = isListingLive && hasCommitments;
  const canResumeListing = isListingPaused;
  const canCloseFunding = isFundingOpen && meetsMinimumFunding;
  const canFailFunding = isFundingOpen && !meetsMinimumFunding;

  let primary: NoteLifecycleActionConfig | null = null;
  const secondary: NoteLifecycleActionConfig[] = [];
  let contextHelper: string | null = null;

  const pushPauseOrResume = () => {
    if (canPauseListing) {
      secondary.push({
        key: "pauseListing",
        label: "Pause campaign",
        variant: "outline",
        helper: "Hides the listing from investors. Existing commitments are held; funds are not returned.",
      });
    }
    if (canResumeListing) {
      secondary.push({
        key: "resumeListing",
        label: "Resume campaign",
        variant: "outline",
      });
    }
  };

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
    pushPauseOrResume();
  } else if (note.status === "ACTIVE" || note.servicingStatus !== "NOT_STARTED") {
    contextHelper = "Servicing is active. Manage receipts and settlement in the Servicing tab.";
  } else if (note.status === "PUBLISHED" || note.status === "FUNDING") {
    if (isListingPaused) {
      contextHelper =
        "Campaign is paused. Existing commitments are held and funds have not been returned.";
      primary = {
        key: "resumeListing",
        label: "Resume campaign",
        variant: "default",
        helper: "Republish the listing so investors can commit again. Existing commitments stay in place.",
      };
    } else {
      contextHelper = isFundingOpen
        ? canFailFunding
          ? `Awaiting investor commitments. Minimum ${note.minimumFundingPercent}% not yet met (currently ${note.fundingPercent.toFixed(1)}%).`
          : "Awaiting investor commitments."
        : "Awaiting funding to open.";
    }
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
    if (canPauseListing) {
      secondary.push({
        key: "pauseListing",
        label: "Pause campaign",
        variant: "outline",
        helper: "Hides the listing from investors. Existing commitments are held; funds are not returned.",
      });
    }
  }

  return {
    primary,
    secondary,
    contextHelper,
    meetsMinimumFunding,
    isFundingOpen,
    isListingLive,
    isListingPaused,
  };
}

/**
 * Primary lifecycle buttons the admin must take now: publish or close funding.
 * Fail funding is supplementary while the listing waits on investors.
 */
const LIFECYCLE_ADMIN_ACTIONS: readonly NoteLifecycleAction[] = ["publish", "closeFunding"];

/** True when Campaign should highlight for a primary admin action. */
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

export type NoteListingAutoCloseInfo = {
  formatted: string;
  relative: string;
  overdue: boolean;
  fullyFunded: boolean;
  label: string;
};

export function getNoteListingAutoCloseInfo(note: NoteDetail): NoteListingAutoCloseInfo | null {
  const closesAtIso = note.listing?.closesAt ?? null;
  if (!closesAtIso) return null;
  const closesAt = new Date(closesAtIso);
  if (Number.isNaN(closesAt.getTime())) return null;
  const now = new Date();
  const diffMs = closesAt.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const days = Math.floor(absMs / 86_400_000);
  const hours = Math.floor((absMs % 86_400_000) / 3_600_000);
  const overdue = diffMs <= 0;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(closesAt);
  const fundingRemaining = Math.max(note.targetAmount - note.fundedAmount, 0);
  const fullyFunded = note.targetAmount > 0 && fundingRemaining < 0.01;
  let relative: string;
  if (days >= 1) {
    relative = `${days} day${days === 1 ? "" : "s"}`;
  } else if (hours >= 1) {
    relative = `${hours} hour${hours === 1 ? "" : "s"}`;
  } else {
    relative = "less than an hour";
  }
  return {
    formatted,
    relative,
    overdue,
    fullyFunded,
    label: fullyFunded
      ? "Fully funded — auto-closing on next cycle"
      : overdue
        ? `Listing past auto-close (${relative} ago, ${formatted})`
        : `Auto-closes in ${relative} (${formatted})`,
  };
}
