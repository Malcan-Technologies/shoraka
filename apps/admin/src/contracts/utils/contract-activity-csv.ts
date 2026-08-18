import type { AdminContractActivityEvent } from "@cashsouk/types";

const EVENT_LABELS: Record<string, string> = {
  APPLICATION_CREATED: "Application created",
  APPLICATION_SUBMITTED: "Application submitted",
  APPLICATION_RESUBMITTED: "Application resubmitted",
  APPLICATION_APPROVED: "Application approved",
  APPLICATION_REJECTED: "Application rejected",
  APPLICATION_WITHDRAWN: "Application withdrawn",
  APPLICATION_COMPLETED: "Application completed",
  APPLICATION_RESET_TO_UNDER_REVIEW: "Application reset to under review",
  SECTION_REVIEWED_APPROVED: "Section approved",
  SECTION_REVIEWED_REJECTED: "Section rejected",
  SECTION_REVIEWED_AMENDMENT_REQUESTED: "Section amendment requested",
  SECTION_REVIEWED_PENDING: "Section reset to pending",
  ITEM_REVIEWED_APPROVED: "Item approved",
  ITEM_REVIEWED_REJECTED: "Item rejected",
  ITEM_REVIEWED_AMENDMENT_REQUESTED: "Item amendment requested",
  ITEM_REVIEWED_PENDING: "Item reset to pending",
  CONTRACT_OFFER_SENT: "Facility offer sent",
  CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: "Acceptance submitted",
  CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: "Acceptance resubmitted",
  CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING: "Acceptance approved for signing",
  CONTRACT_OFFER_ACCEPTED: "Facility offer signed",
  CONTRACT_OFFER_REJECTED: "Facility offer withdrawn",
  CONTRACT_OFFER_RETRACTED: "Facility offer retracted",
  CONTRACT_OFFER_EXPIRED: "Facility offer expired",
  CONTRACT_SIGNING_DEADLINE_EXTENDED: "Signing deadline extended",
  CONTRACT_WITHDRAWN: "Facility offer withdrawn",
  SIGNING_PACKAGE_CREATED: "Signing package created",
  SIGNING_PACKAGE_SENT: "Signing package sent",
  SIGNING_PACKAGE_COMPLETED: "Signing package completed",
  SIGNING_PACKAGE_VOIDED: "Signing package voided",
  AMENDMENTS_SUBMITTED: "Amendment request sent",
};

export function formatContractActivityEventLabel(eventType: string) {
  return (
    EVENT_LABELS[eventType] ??
    eventType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function metadataCell(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return JSON.stringify(metadata);
}

export function buildContractActivityCsv(events: AdminContractActivityEvent[]) {
  const header = [
    "createdAt",
    "event",
    "eventType",
    "actorName",
    "actorUserId",
    "portal",
    "applicationId",
    "remark",
    "metadata",
  ];
  const rows = events.map((event) => [
    event.createdAt,
    formatContractActivityEventLabel(event.eventType),
    event.eventType,
    event.actorName ?? "",
    event.actorUserId ?? "",
    event.portal ?? "",
    event.applicationId ?? "",
    event.remark ?? "",
    metadataCell(event.metadata),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
