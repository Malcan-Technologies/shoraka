import type { NoteEvent } from "@cashsouk/types";
import {
  buildAdminActivityCsv,
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";

const EVENT_LABELS: Record<string, string> = {
  NOTE_CREATED: "Note Created",
  NOTE_CREATED_FROM_INVOICE: "Note Created",
  NOTE_DRAFT_UPDATED: "Draft Updated",
  UPDATE_DRAFT: "Draft Updated",
  UPDATE_FEATURED_SETTINGS: "Featured Settings Updated",
  NOTE_PUBLISHED: "Note Published",
  PUBLISH: "Note Published",
  NOTE_UNPUBLISHED: "Unpublished from Marketplace",
  PAUSE_LISTING: "Campaign Paused",
  RESUME_LISTING: "Campaign Resumed",
  UNPUBLISH: "Unpublished from Marketplace",
  PROSPECTUS_REVIEW_APPROVE: "Prospectus Approved",
  PROSPECTUS_REVIEW_CREATE: "Prospectus Review Created",
  PROSPECTUS_REVIEW_DRAFT_UPDATE: "Prospectus Draft Updated",
  PROSPECTUS_APPROVAL_INVALIDATED_EDIT: "Prospectus Approval Cleared After Edit",
  PROSPECTUS_APPROVAL_INVALIDATED_SOURCE: "Prospectus Approval Cleared After Source Change",
  PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH: "Prospectus Approval Cleared After Unpublish",
  INVESTMENT_COMMITTED: "Investment Committed",
  NOTE_FUNDING_CLOSED: "Funding Closed",
  CLOSE_FUNDING: "Funding Closed",
  NOTE_FUNDING_FAILED: "Funding Unsuccessful",
  FAIL_FUNDING: "Funding Unsuccessful",
  NOTE_ACTIVATED: "Note Activated",
  ACTIVATE: "Note Activated",
  ISSUER_PAYMENT_SUBMITTED: "Repayment Submitted",
  PAYMENT_RECORDED: "Repayment Received",
  PAYMENT_RECEIVED: "Repayment Received",
  PAYMENT_APPROVED: "Repayment Approved",
  PAYMENT_REJECTED: "Repayment Rejected",
  SETTLEMENT_PREVIEWED: "Settlement Previewed",
  SETTLEMENT_APPROVED: "Settlement Approved",
  SETTLEMENT_POSTED: "Settlement Posted",
  LATE_CHARGE_APPROVED: "Late Charge Approved",
  OVERDUE_LATE_CHARGE_CHECKED: "Note Entered Arrears",
  ARREARS_LETTER_GENERATED: "Arrears Letter Generated",
  DEFAULT_LETTER_GENERATED: "Default Letter Generated",
  SETTLEMENT_TRUSTEE_LETTER_GENERATED: "Settlement Trustee Letter Generated",
  SETTLEMENT_TRUSTEE_EMAIL_SENT: "Settlement Trustee Email Sent",
  SETTLEMENT_TRUSTEE_LETTER_SUBMITTED: "Settlement Trustee Letter Submitted",
  SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED: "Settlement Trustee Instruction Completed",
  WITHDRAWAL_TRUSTEE_EMAIL_SENT: "Withdrawal Trustee Email Sent",
  NOTE_DEFAULT_MARKED: "Note Defaulted",
  WAIVE_FACILITY_FEE_COLLECTION: "Facility Fee Collection Waived",
  NOTE_FACILITY_FEE_COLLECTION_WAIVED: "Facility Fee Collection Waived",
  ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED: "Disbursement Instruction Created",
  WITHDRAWAL_LETTER_GENERATED: "Withdrawal Letter Generated",
  WITHDRAWAL_SUBMITTED_TO_TRUSTEE: "Withdrawal Submitted to Trustee",
  WITHDRAWAL_BENEFICIARY_UPDATED: "Withdrawal Beneficiary Updated",
  WITHDRAWAL_COMPLETED: "Withdrawal Completed",
  FACILITY_OCCUPANCY_UPDATED: "Facility Occupancy Updated",
  SHORAKA_ORDER_SUBMITTED: "Tawarruq Order Submitted",
  SHORAKA_CERTIFICATE_FETCHED: "Tawarruq Certificate Retrieved",
  INVESTMENT_NOTE_CERTIFICATE_GENERATED: "Investment Note Certificate Generated",
  INVESTMENT_NOTE_CERTIFICATE_REISSUED: "Investment Note Certificate Reissued",
  SETTLEMENT_HIBAH_RECEIPT_GENERATED: "Settlement & Hibah Receipt Generated",
  SETTLEMENT_HIBAH_RECEIPT_REISSUED: "Settlement & Hibah Receipt Reissued",
  INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED: "Investment Settlement Confirmation Generated",
};

const RESIDUAL_RETURN_EVENT_LABELS: Record<string, string> = {
  WITHDRAWAL_LETTER_GENERATED: "Residual Return Letter Generated",
  WITHDRAWAL_SUBMITTED_TO_TRUSTEE: "Residual Return Submitted to Trustee",
  WITHDRAWAL_COMPLETED: "Residual Return Completed",
};

export function formatNoteActivityEventLabel(
  eventType: string,
  metadata?: Record<string, unknown> | null
) {
  const fallback = eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  let label = EVENT_LABELS[eventType] ?? fallback;
  if (
    metadata?.withdrawalType === "ISSUER_RESIDUAL_RETURN" &&
    RESIDUAL_RETURN_EVENT_LABELS[eventType]
  ) {
    label = RESIDUAL_RETURN_EVENT_LABELS[eventType];
  }
  if (metadata?.resend === true) {
    if (eventType === "WITHDRAWAL_TRUSTEE_EMAIL_SENT") {
      label = "Withdrawal Trustee Email Redelivered";
    } else if (eventType === "SETTLEMENT_TRUSTEE_EMAIL_SENT") {
      label = "Settlement Trustee Email Redelivered";
    }
  }
  label = label.replace(/\bShoraka\s+Stp\b/g, "Tawarruq Transaction");
  label = label.replace(/\bShoraka\b/g, "Tawarruq");
  return label;
}

function noteEventAmount(metadata: Record<string, unknown> | null | undefined): string | number | null {
  if (!metadata) return null;
  for (const key of ["amount", "investmentAmount", "withdrawalAmount", "hibahAmount"]) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function noteEventCanonicalReference(event: NoteEvent): string {
  const metadata = event.metadata;
  if (metadata) {
    for (const key of [
      "withdrawalReference",
      "settlementReference",
      "noteReference",
      "note_reference",
      "displayReference",
      "contractReference",
    ]) {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    const nestedStates = [metadata.beforeState, metadata.afterState];
    for (const state of nestedStates) {
      if (state && typeof state === "object" && !Array.isArray(state)) {
        const record = state as Record<string, unknown>;
        for (const key of ["noteReference", "note_reference"]) {
          const value = record[key];
          if (typeof value === "string" && value.trim()) return value.trim();
        }
      }
    }
    const tradeOrderId = metadata.trade_order_id ?? metadata.tradeOrderId;
    if (typeof tradeOrderId === "string" && tradeOrderId.trim()) return tradeOrderId.trim();
  }
  return event.targetId ?? event.noteId;
}

export function noteEventToActivityCsvRow(event: NoteEvent): AdminActivityCsvRow {
  return {
    createdAt: event.createdAt,
    event: formatNoteActivityEventLabel(event.eventType, event.metadata),
    eventType: event.eventType,
    actor: event.actorName?.trim() || "",
    actorUserId: event.actorUserId ?? "",
    portal: event.portal ?? "",
    remark: "",
    metadata: mergeActivityCsvMetadata(event.metadata, {
      actorRole: event.actorRole,
      correlationId: event.correlationId,
    }),
    actorType: event.actorType ?? event.actorRole,
    source: event.source ?? event.portal,
    targetType: event.targetType,
    targetReference: noteEventCanonicalReference(event),
    correlationId: event.correlationId,
    amount: noteEventAmount(event.metadata),
  };
}

export function buildNoteActivityCsv(events: NoteEvent[]) {
  return buildAdminActivityCsv(events.map(noteEventToActivityCsvRow));
}
