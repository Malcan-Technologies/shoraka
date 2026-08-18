import type { NoteAuditLogDto } from "@cashsouk/types";

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
  SHORAKA_ORDER_SUBMITTED: "Tawarruq order submitted",
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

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function metadataCell(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return JSON.stringify(metadata);
}

export function buildNoteActivityCsv(events: NoteAuditLogDto[]) {
  const header = [
    "occurredAt",
    "event",
    "eventType",
    "actorUserId",
    "actorType",
    "portal",
    "correlationId",
    "metadata",
  ];
  const rows = events.map((event) => [
    event.occurredAt,
    formatNoteActivityEventLabel(event.eventType),
    event.eventType,
    event.actor.userId ?? "",
    event.actor.type ?? "",
    event.portal ?? "",
    event.correlationId ?? "",
    metadataCell(event.metadata),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
