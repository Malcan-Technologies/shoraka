import type { NoteDetail, WithdrawalInstruction } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { getAdminStatusToken, pickHighestAdminTabToken } from "@/lib/admin-status-token";
import { resolveProspectusStatusCard } from "@/notes/components/note-prospectus-status-card.model";
import {
  buildNoteLifecycleActionPlan,
  findIssuerDisbursementWithdrawal,
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
  "overview",
  "disbursement",
  "servicing",
  "late-payment",
  "investors",
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
    (settlement) => settlement.serviceFeeTrusteeStatus !== "SUBMITTED_TO_TRUSTEE"
  );
  const trusteeWaitingOnOther =
    postedNeedingTrustee.length > 0 &&
    postedNeedingTrustee.every(
      (settlement) => settlement.serviceFeeTrusteeStatus === "SUBMITTED_TO_TRUSTEE"
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

export function resolveNoteOverviewTabStatus(note: NoteDetail): SimpleTabStatus {
  if (hasNoteLifecycleAdminAction(note)) {
    return "needs-action";
  }
  if (isNoteLifecycleVisuallyComplete(note)) return "done";
  return "in-progress";
}

export function resolveNoteInvestorsTabToken(note: NoteDetail): StatusToken {
  const investments = note.investments ?? [];
  if (investments.length === 0) {
    if (note.fundingStatus === "OPEN") return "submitted";
    if (isNoteLifecycleVisuallyComplete(note)) return "success";
    return "neutral";
  }
  return pickHighestAdminTabToken(
    investments.map((investment) => getAdminStatusToken(investment.status))
  );
}

export function resolveNoteLedgerTabToken(note: NoteDetail): StatusToken {
  if (isNoteLifecycleVisuallyComplete(note)) return "success";
  if (
    note.status === "ARREARS" ||
    note.status === "DEFAULTED" ||
    note.servicingStatus === "ARREARS"
  ) {
    return "rejected";
  }
  if (note.status === "ACTIVE" || note.servicingStatus === "CURRENT") return "active";
  if (note.fundingStatus === "FUNDED" || note.status === "FUNDING") return "submitted";
  if ((note.events?.length ?? 0) > 0) return "submitted";
  return "neutral";
}

export function resolveNoteActivityTabToken(note: NoteDetail): StatusToken {
  if (isNoteLifecycleVisuallyComplete(note)) return "success";
  if ((note.events?.length ?? 0) > 0) return "submitted";
  return "neutral";
}

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
  tabId: "overview",
  title: "No admin action required",
  description: "Nothing on this note is waiting on CashSouk right now.",
  ctaLabel: "Open Overview",
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
      tabId: "overview",
      title: "Prospectus approval required",
      description:
        "Review and approve the prospectus in the sidebar before this note can be published to the marketplace.",
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
      tabId: "overview",
      title: `Lifecycle action available: ${lifecyclePrimary.label}`,
      description:
        lifecyclePrimary.helper ?? "Continue the note lifecycle from the Overview tab.",
      ctaLabel: "Open Overview",
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
