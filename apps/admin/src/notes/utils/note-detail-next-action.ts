import type { NoteDetail, WithdrawalInstruction } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { resolveProspectusStatusCard } from "@/notes/components/note-prospectus-status-card.model";
import {
  buildNoteLifecycleActionPlan,
  findIssuerDisbursementWithdrawal,
  getNoteLifecycleCardTone,
  hasNoteLifecycleAdminAction,
} from "@/notes/utils/note-lifecycle-actions";
import {
  resolveLatePaymentTimeline,
  type LatePaymentWorkflowPhase,
} from "@/notes/utils/late-payment-workflow";
import {
  isNoteLifecycleVisuallyComplete,
  postedSettlementsNeedingTrusteeInstruction,
} from "@/notes/utils/settlement-trustee-workflow";
import type { SimpleTabStatus } from "@/notes/utils/workflow-status-tokens";

export const NOTE_DETAIL_TAB_IDS = [
  "campaign",
  "disbursement",
  "servicing",
  "late-payment",
  "ledger",
  "activity",
] as const;

export type NoteDetailTabId = (typeof NOTE_DETAIL_TAB_IDS)[number];

export function isNoteDetailTabId(value: string): value is NoteDetailTabId {
  return (NOTE_DETAIL_TAB_IDS as readonly string[]).includes(value);
}

/**
 * Admin tab dots follow the admin status map: yellow = CashSouk must act,
 * blue = waiting on someone else, green = done, grey = not started.
 */
export function noteDetailTabStatusToken(status: SimpleTabStatus): StatusToken {
  switch (status) {
    case "done":
      return "success";
    case "needs-action":
      return "action";
    case "in-progress":
      return "submitted";
    default:
      return "neutral";
  }
}

export function noteLatePaymentTabStatusToken(phase: LatePaymentWorkflowPhase): StatusToken {
  if (phase === "not-needed") return "success";
  if (phase === "defaulted") return "rejected";
  // In grace is still admin monitoring (branding: Active · late stays yellow).
  if (phase === "in-grace" || phase === "arrears" || phase === "default-eligible") return "action";
  return "neutral";
}

/** Letters or a default decision are available to the admin right now. */
export function latePaymentPhaseNeedsAdminAction(phase: LatePaymentWorkflowPhase): boolean {
  return phase === "arrears" || phase === "default-eligible";
}

/** Active issuer-disbursement instruction; cancelled attempts are ignored. */
export function findNoteDisbursementWithdrawal(note: NoteDetail): WithdrawalInstruction | null {
  return findIssuerDisbursementWithdrawal(note);
}

export function resolveNoteDisbursementTabStatus(note: NoteDetail): SimpleTabStatus {
  const withdrawal = findNoteDisbursementWithdrawal(note);
  if (!withdrawal) return "not-started";
  if (withdrawal.status === "COMPLETED") return "done";
  if (withdrawal.status === "SUBMITTED_TO_TRUSTEE") return "in-progress";
  return "needs-action";
}

export function resolveNoteServicingTabStatus(note: NoteDetail): SimpleTabStatus {
  if (isNoteLifecycleVisuallyComplete(note)) return "done";

  const servicingNotStarted =
    note.servicingStatus === "NOT_STARTED" ||
    (note.status !== "ACTIVE" &&
      note.status !== "ARREARS" &&
      note.status !== "DEFAULTED" &&
      note.status !== "REPAID");
  if (servicingNotStarted) return "not-started";

  const hasPendingPayments = note.payments.some((payment) => payment.status === "PENDING");
  const hasUnpostedSettlement = note.settlements.some(
    (settlement) => settlement.status !== "POSTED" && settlement.status !== "VOID"
  );
  const postedNeedingTrustee = postedSettlementsNeedingTrusteeInstruction(note);
  const trusteeNeedsAdmin = postedNeedingTrustee.some(
    (settlement) => settlement.settlementTrusteeStatus !== "SUBMITTED_TO_TRUSTEE"
  );
  const trusteeWaitingOnOther =
    postedNeedingTrustee.length > 0 &&
    postedNeedingTrustee.every(
      (settlement) => settlement.settlementTrusteeStatus === "SUBMITTED_TO_TRUSTEE"
    );

  if (hasPendingPayments || hasUnpostedSettlement || trusteeNeedsAdmin) {
    return "needs-action";
  }

  const isArrearsOrDefault =
    note.status === "ARREARS" ||
    note.status === "DEFAULTED" ||
    note.servicingStatus === "ARREARS" ||
    note.servicingStatus === "DEFAULTED";
  if (isArrearsOrDefault) return "needs-action";

  if (trusteeWaitingOnOther) return "in-progress";

  return "in-progress";
}

export function noteProspectusNeedsReview(note: NoteDetail): boolean {
  return resolveProspectusStatusCard(note).emphasize;
}

function campaignInvestmentNeedsAdmin(note: NoteDetail): boolean {
  return (note.investments ?? []).some(
    (investment) => getAdminStatusToken(investment.status) === "action"
  );
}

function isCampaignComplete(note: NoteDetail): boolean {
  return (
    note.fundingStatus === "FUNDED" ||
    note.fundingStatus === "CLOSED" ||
    note.status === "ACTIVE" ||
    note.status === "ARREARS" ||
    note.status === "DEFAULTED" ||
    note.status === "REPAID" ||
    isNoteLifecycleVisuallyComplete(note)
  );
}

export function resolveNoteCampaignTabStatus(note: NoteDetail): SimpleTabStatus {
  if (hasNoteLifecycleAdminAction(note) || campaignInvestmentNeedsAdmin(note)) {
    return "needs-action";
  }
  if (getNoteLifecycleCardTone(note) === "waiting") {
    return "in-progress";
  }
  if (isCampaignComplete(note)) {
    return "done";
  }
  return "not-started";
}

/** Ledger and Activity are always present and have no workflow status. */
export const NOTE_REFERENCE_TAB_TOKEN = "neutral" as const satisfies StatusToken;

export type NoteDetailNextActionTone = "action" | "neutral";

export type NoteDetailNextAction = {
  /** Tab to auto-open (unless `?tab=` already names a valid tab). */
  tabId: NoteDetailTabId;
  title: string;
  description: string;
  ctaLabel: string;
  /** Navigate out of the note (e.g. prospectus review). Takes precedence over the tab CTA. */
  href?: string;
  /** `action` renders the yellow banner; `neutral` means nothing is waiting on admin. */
  tone: NoteDetailNextActionTone;
};

const NO_ACTION_REQUIRED: NoteDetailNextAction = {
  tabId: "campaign",
  title: "No admin action required",
  description: "Nothing on this note is waiting on CashSouk right now.",
  ctaLabel: "Open Campaign",
  tone: "neutral",
};

/**
 * Single source of truth for "what should the admin do on this note", used for
 * both the next-action banner and the initially selected tab.
 */
export function resolveNoteDetailNextAction(note: NoteDetail): NoteDetailNextAction {
  if (isNoteLifecycleVisuallyComplete(note)) return NO_ACTION_REQUIRED;

  if (noteProspectusNeedsReview(note)) {
    return {
      tabId: "campaign",
      title: "Prospectus approval required",
      description:
        "Review and approve the prospectus from the Campaign tab before this note can be published to the marketplace.",
      ctaLabel: "Review prospectus",
      href: `/notes/${note.id}/prospectus`,
      tone: "action",
    };
  }

  const lifecyclePrimary = hasNoteLifecycleAdminAction(note)
    ? buildNoteLifecycleActionPlan(note).primary
    : null;
  if (lifecyclePrimary) {
    return {
      tabId: "campaign",
      title: `Campaign action available: ${lifecyclePrimary.label}`,
      description:
        lifecyclePrimary.helper ?? "Continue the marketplace campaign from the Campaign tab.",
      ctaLabel: "Open Campaign",
      tone: "action",
    };
  }

  const disbursementStatus = resolveNoteDisbursementTabStatus(note);
  if (
    note.fundingStatus === "FUNDED" &&
    (disbursementStatus === "needs-action" || disbursementStatus === "not-started")
  ) {
    return {
      tabId: "disbursement",
      title: "Issuer disbursement outstanding",
      description:
        "Funding has closed. Complete Tawarruq execution, the certificate, and the trustee instruction before servicing begins.",
      ctaLabel: "Open Disbursement",
      tone: "action",
    };
  }

  const latePayment = resolveLatePaymentTimeline(note);
  if (latePaymentPhaseNeedsAdminAction(latePayment.phase)) {
    return {
      tabId: "late-payment",
      title:
        latePayment.phase === "default-eligible"
          ? "Note is eligible for default"
          : "Note is in arrears",
      description: `${latePayment.latePaymentTimingLabel}. Generate the required letters or mark the default from the Late Payment tab.`,
      ctaLabel: "Open Late Payment",
      tone: "action",
    };
  }

  if (resolveNoteServicingTabStatus(note) === "needs-action") {
    return {
      tabId: "servicing",
      title: "Servicing needs attention",
      description:
        "Reconcile repayment receipts and post the settlement waterfall from the Servicing tab.",
      ctaLabel: "Open Servicing",
      tone: "action",
    };
  }

  return NO_ACTION_REQUIRED;
}
