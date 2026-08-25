import type { NoteEvent } from "@cashsouk/types";
import {
  buildAdminActivityCsv,
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";

const EVENT_LABELS: Record<string, string> = {
  NOTE_CREATED: "Note created",
  NOTE_CREATED_FROM_INVOICE: "Note created",
  NOTE_DRAFT_UPDATED: "Draft updated",
  UPDATE_DRAFT: "Draft updated",
  UPDATE_FEATURED_SETTINGS: "Featured settings updated",
  NOTE_PUBLISHED: "Note Published",
  PUBLISH: "Note Published",
  NOTE_UNPUBLISHED: "Unpublished from marketplace",
  PAUSE_LISTING: "Campaign paused",
  RESUME_LISTING: "Campaign resumed",
  UNPUBLISH: "Unpublished from marketplace",
  PROSPECTUS_REVIEW_APPROVE: "Prospectus approved",
  PROSPECTUS_REVIEW_CREATE: "Prospectus review created",
  PROSPECTUS_REVIEW_DRAFT_UPDATE: "Prospectus draft updated",
  PROSPECTUS_APPROVAL_INVALIDATED_EDIT: "Prospectus approval cleared after edit",
  PROSPECTUS_APPROVAL_INVALIDATED_SOURCE: "Prospectus approval cleared after source change",
  PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH: "Prospectus approval cleared after unpublish",
  INVESTMENT_COMMITTED: "Investment committed",
  NOTE_FUNDING_CLOSED: "Funding Closed",
  CLOSE_FUNDING: "Funding Closed",
  NOTE_FUNDING_FAILED: "Funding unsuccessful",
  FAIL_FUNDING: "Funding unsuccessful",
  NOTE_ACTIVATED: "Note Activated",
  ACTIVATE: "Note Activated",
  ISSUER_PAYMENT_SUBMITTED: "Repayment Submitted",
  PAYMENT_RECORDED: "Repayment received",
  PAYMENT_RECEIVED: "Repayment received",
  PAYMENT_APPROVED: "Repayment approved",
  PAYMENT_REJECTED: "Repayment Rejected",
  SETTLEMENT_PREVIEWED: "Settlement previewed",
  SETTLEMENT_APPROVED: "Settlement approved",
  SETTLEMENT_POSTED: "Settlement posted",
  LATE_CHARGE_APPROVED: "Late charge approved",
  OVERDUE_LATE_CHARGE_CHECKED: "Overdue Review Completed",
  ARREARS_LETTER_GENERATED: "Arrears letter generated",
  DEFAULT_LETTER_GENERATED: "Default letter generated",
  SERVICE_FEE_TRUSTEE_LETTER_GENERATED: "Settlement trustee letter generated",
  SERVICE_FEE_TRUSTEE_EMAIL_SENT: "Settlement Trustee Email Sent",
  SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED: "Settlement trustee letter submitted",
  SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED: "Settlement trustee instruction completed",
  WITHDRAWAL_TRUSTEE_EMAIL_SENT: "Withdrawal Trustee Email Sent",
  NOTE_DEFAULT_MARKED: "Note Defaulted",
  WAIVE_FACILITY_FEE_COLLECTION: "Facility Fee Collection Waived",
  NOTE_FACILITY_FEE_COLLECTION_WAIVED: "Facility fee collection waived",
  ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED: "Disbursement instruction created",
  WITHDRAWAL_LETTER_GENERATED: "Withdrawal letter generated",
  WITHDRAWAL_SUBMITTED_TO_TRUSTEE: "Withdrawal Submitted to Trustee",
  WITHDRAWAL_BENEFICIARY_UPDATED: "Withdrawal beneficiary updated",
  WITHDRAWAL_COMPLETED: "Withdrawal Completed",
  FACILITY_OCCUPANCY_UPDATED: "Facility occupancy updated",
  SHORAKA_ORDER_SUBMITTED: "Tawarruq Order Submitted",
  SHORAKA_CERTIFICATE_FETCHED: "Tawarruq Certificate Retrieved",
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
  if (metadata?.resend === true) {
    if (eventType === "WITHDRAWAL_TRUSTEE_EMAIL_SENT") {
      label = "Withdrawal Trustee Email Redelivered";
    } else if (eventType === "SERVICE_FEE_TRUSTEE_EMAIL_SENT") {
      label = "Settlement Trustee Email Redelivered";
    }
  }
  label = label.replace(/\bShoraka\s+Stp\b/g, "Tawarruq Transaction");
  label = label.replace(/\bShoraka\b/g, "Tawarruq");
  return label;
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
  };
}

export function buildNoteActivityCsv(events: NoteEvent[]) {
  return buildAdminActivityCsv(events.map(noteEventToActivityCsvRow));
}
