import type { AdminContractActivityEvent } from "@cashsouk/types";
import {
  buildAdminActivityCsv,
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";

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
  CONTRACT_FACILITY_OCCUPANCY_UPDATED: "Facility occupancy updated",
  CONTRACT_OFFER_EXPIRED: "Facility offer expired",
  CONTRACT_SIGNING_DEADLINE_EXTENDED: "Signing deadline extended",
  CONTRACT_WITHDRAWN: "Facility offer rejected",
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

export function contractEventToActivityCsvRow(
  event: AdminContractActivityEvent
): AdminActivityCsvRow {
  return {
    createdAt: event.createdAt,
    event: formatContractActivityEventLabel(event.eventType),
    eventType: event.eventType,
    actor: event.actorName?.trim() || "",
    actorUserId: event.actorUserId ?? "",
    portal: event.portal ?? "",
    remark: event.remark ?? "",
    metadata: mergeActivityCsvMetadata(event.metadata, {
      applicationId: event.applicationId,
    }),
  };
}

export function buildContractActivityCsv(events: AdminContractActivityEvent[]) {
  return buildAdminActivityCsv(events.map(contractEventToActivityCsvRow));
}
