import type {
  NoteDetail,
  WithdrawalInstruction,
  AdminInvestmentSettlementConfirmationsPayload,
  SettlementHibahReceiptPdfPayload,
} from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import {
  officialDocumentWorkflowTone,
  workflowToneToStatusToken,
  withdrawalWorkflowTone,
} from "@/notes/utils/workflow-status-tokens";
import {
  hasUnpaidIssuerResidual,
  isNoteSettlementLifecycleFinished,
  noteDetailTabStatusToken,
  resolveNoteServicingTabStatus,
} from "@/notes/utils/note-detail-next-action";

function pickHighestSeverityStatusToken(
  tokens: Iterable<StatusToken>,
  fallback: StatusToken = "neutral"
): StatusToken {
  // Explicit severity order required by the UI spec:
  // red/rejected > yellow/action > blue/submitted > green/success > neutral
  const rank: Partial<Record<StatusToken, number>> = {
    rejected: 4,
    action: 3,
    submitted: 2,
    success: 1,
    neutral: 0,
    // These tokens exist in the UI `StatusToken` union, but are not expected for
    // the note workflow stage tabs. Keep the mapping deterministic.
    active: 3,
    "in-progress": 2,
    completed: 1,
  };

  let best = fallback;
  let bestRank = rank[best] ?? 0;

  for (const token of tokens) {
    const nextRank = rank[token] ?? 0;
    if (nextRank > bestRank) {
      best = token;
      bestRank = nextRank;
    }
  }

  return best;
}

function investmentSettlementConfirmationsPayloadToStatusToken(
  payload: AdminInvestmentSettlementConfirmationsPayload
): StatusToken {
  if (payload.expectedCount === 0 && payload.confirmations.length === 0) {
    return "neutral";
  }

  const reviewStatuses = payload.confirmations.map((row) => row.reviewVersion?.status ?? null);
  if (payload.failedCount > 0 || reviewStatuses.includes("FAILED")) return workflowToneToStatusToken("danger");
  if (payload.pendingCount > 0 || reviewStatuses.includes("PENDING")) return workflowToneToStatusToken("active");
  if (reviewStatuses.includes("READY")) return workflowToneToStatusToken("active");

  if (payload.confirmations.some((row) => row.canGenerate || row.status === "NONE")) {
    return payload.canGenerateAll || payload.confirmations.some((row) => row.canGenerate)
      ? workflowToneToStatusToken("active")
      : workflowToneToStatusToken("neutral");
  }

  return workflowToneToStatusToken("success");
}

function settlementHibahReceiptPayloadToStatusToken(
  payload: SettlementHibahReceiptPdfPayload
): StatusToken {
  const reviewStatus = payload.reviewVersion?.status ?? null;
  const tone = officialDocumentWorkflowTone({
    status: payload.status,
    canGenerate: payload.canGenerate,
    reviewStatus,
  });
  return workflowToneToStatusToken(tone);
}

export function resolveDisbursementStageStatusToken(input: {
  note: NoteDetail;
  disbursementWithdrawal: WithdrawalInstruction | null;
  investmentNoteCertificate:
    | {
        status: "NONE" | "PENDING" | "READY" | "FAILED";
        canGenerate: boolean;
        reviewVersion: { status: "PENDING" | "READY" | "FAILED" } | null;
      }
    | null;
}): StatusToken {
  const { note, disbursementWithdrawal, investmentNoteCertificate } = input;
  if (!disbursementWithdrawal) {
    return isNoteSettlementLifecycleFinished(note) ? "success" : "neutral";
  }

  const certificateFailed =
    investmentNoteCertificate?.status === "FAILED" ||
    investmentNoteCertificate?.reviewVersion?.status === "FAILED";
  if (isNoteSettlementLifecycleFinished(note)) {
    return certificateFailed ? "rejected" : "success";
  }

  const tokens: StatusToken[] = [];

  // Issuer payout / trustee instruction (drives the main disbursement lifecycle).
  tokens.push(workflowToneToStatusToken(withdrawalWorkflowTone(disbursementWithdrawal.status)));

  // Investment Note Certificate is a child workflow card inside Disbursement.
  if (investmentNoteCertificate && disbursementWithdrawal.status !== "CANCELLED") {
    const reviewStatus = investmentNoteCertificate.reviewVersion?.status ?? null;
    const tone = officialDocumentWorkflowTone({
      status: investmentNoteCertificate.status,
      canGenerate: investmentNoteCertificate.canGenerate,
      reviewStatus,
    });
    tokens.push(workflowToneToStatusToken(tone));
  }

  return pickHighestSeverityStatusToken(tokens);
}

export function resolveServicingStageStatusToken(input: {
  note: NoteDetail;
  settlementHibahReceipt: SettlementHibahReceiptPdfPayload | undefined;
  investmentSettlementConfirmations:
    | AdminInvestmentSettlementConfirmationsPayload
    | undefined;
}): StatusToken {
  const { note, settlementHibahReceipt, investmentSettlementConfirmations } = input;
  const baseSimple = resolveNoteServicingTabStatus(note);
  const baseToken = noteDetailTabStatusToken(baseSimple);

  // Preserve existing neutral/not-started behavior until servicing is actually relevant.
  if (baseSimple === "not-started") return baseToken;

  if (isNoteSettlementLifecycleFinished(note)) {
    const hibahFailed =
      settlementHibahReceipt?.status === "FAILED" ||
      settlementHibahReceipt?.reviewVersion?.status === "FAILED";
    const confirmationsFailed =
      (investmentSettlementConfirmations?.failedCount ?? 0) > 0 ||
      investmentSettlementConfirmations?.confirmations.some(
        (row) => row.reviewVersion?.status === "FAILED"
      );
    if (hibahFailed || confirmationsFailed) return "rejected";
    if (hasUnpaidIssuerResidual(note)) return "action";
    return "success";
  }

  const tokens: StatusToken[] = [baseToken];

  if (settlementHibahReceipt) {
    tokens.push(settlementHibahReceiptPayloadToStatusToken(settlementHibahReceipt));
  }

  if (investmentSettlementConfirmations) {
    tokens.push(
      investmentSettlementConfirmationsPayloadToStatusToken(
        investmentSettlementConfirmations
      )
    );
  }

  return pickHighestSeverityStatusToken(tokens);
}

