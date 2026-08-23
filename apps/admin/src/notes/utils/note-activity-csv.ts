import type { NoteAuditLogDto } from "@cashsouk/types";
import {
  buildAdminActivityCsv,
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";

const EVENT_LABELS: Record<string, string> = {
  NOTE_CREATED: "Note created",
  NOTE_DRAFT_UPDATED: "Draft updated",
  NOTE_PUBLISHED: "Published to marketplace",
  NOTE_UNPUBLISHED: "Unpublished from marketplace",
  NOTE_CAMPAIGN_PAUSED: "Campaign paused",
  NOTE_CAMPAIGN_RESUMED: "Campaign resumed",
  UNPUBLISH: "Unpublished from marketplace",
  PROSPECTUS_REVIEW_APPROVE: "Prospectus approved",
  PROSPECTUS_REVIEW_CREATE: "Prospectus review created",
  PROSPECTUS_REVIEW_DRAFT_UPDATE: "Prospectus draft updated",
  PROSPECTUS_APPROVAL_INVALIDATED_EDIT: "Prospectus approval cleared after edit",
  PROSPECTUS_APPROVAL_INVALIDATED_SOURCE: "Prospectus approval cleared after source change",
  PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH: "Prospectus approval cleared after unpublish",
  NOTE_FUNDING_CLOSED: "Funding closed",
  CLOSE_FUNDING: "Funding closed",
  NOTE_FUNDING_FAILED: "Funding failed",
  FAIL_FUNDING: "Funding failed",
  NOTE_ACTIVATED: "Note activated",
  PAYMENT_RECORDED: "Payment recorded",
  SETTLEMENT_PREVIEWED: "Settlement previewed",
  SETTLEMENT_APPROVED: "Settlement approved",
  SETTLEMENT_POSTED: "Settlement posted",
  LATE_CHARGE_APPROVED: "Late charge approved",
  OVERDUE_LATE_CHARGE_CHECKED: "Overdue late charge checked",
  ARREARS_LETTER_GENERATED: "Arrears letter generated",
  DEFAULT_NOTICE_GENERATED: "Default notice generated",
  SERVICE_FEE_TRUSTEE_LETTER_GENERATED: "Settlement trustee letter generated",
  SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED: "Settlement trustee letter submitted",
  SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED: "Settlement trustee instruction completed",
  NOTE_DEFAULT_MARKED: "Default marked",
  NOTE_MARKED_DEFAULT: "Default marked",
  SHORAKA_ORDER_SUBMITTED: "Tawarruq order submitted",
  SHORAKA_CERTIFICATE_RECEIVED: "Tawarruq Certificate fetched",
  SHORAKA_CERTIFICATE_FETCHED: "Tawarruq Certificate fetched",
};

export function formatNoteActivityEventLabel(eventType: string) {
  const fallback = eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  let label = EVENT_LABELS[eventType] ?? fallback;
  label = label.replace(/\bShoraka\s+Stp\b/g, "Tawarruq Transaction");
  label = label.replace(/\bShoraka\b/g, "Tawarruq");
  return label;
}

export function noteAuditLogToActivityCsvRow(event: NoteAuditLogDto): AdminActivityCsvRow {
  return {
    createdAt: event.occurredAt,
    event: formatNoteActivityEventLabel(event.eventType),
    eventType: event.eventType,
    actor: event.actor.displayName?.trim() || "",
    actorUserId: event.actor.userId ?? "",
    portal: event.portal ?? "",
    remark: "",
    metadata: mergeActivityCsvMetadata(event.metadata, {
      actorType: event.actor.type,
      correlationId: event.correlationId,
    }),
  };
}

export function buildNoteActivityCsv(events: NoteAuditLogDto[]) {
  return buildAdminActivityCsv(events.map(noteAuditLogToActivityCsvRow));
}
