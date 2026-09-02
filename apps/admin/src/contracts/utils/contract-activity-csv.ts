import type { AdminContractActivityEvent } from "@cashsouk/types";
import {
  buildAdminActivityCsv,
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";

const EVENT_LABELS: Record<string, string> = {
  APPLICATION_CREATED: "Application Created",
  APPLICATION_PROCESSING_FEE_PAID: "Application Processing Fee Paid",
  FACILITY_FEE_PAID: "Facility Fee Paid",
  APPLICATION_SUBMITTED: "Application Submitted",
  APPLICATION_RESUBMITTED: "Application Resubmitted",
  APPLICATION_APPROVED: "Application Approved",
  APPLICATION_REJECTED: "Application Rejected",
  APPLICATION_WITHDRAWN: "Application Withdrawn",
  APPLICATION_COMPLETED: "Application Completed",
  APPLICATION_RESET_TO_UNDER_REVIEW: "Application Returned to Review",
  SECTION_REVIEWED_APPROVED: "Section Approved",
  SECTION_REVIEWED_REJECTED: "Section Rejected",
  SECTION_REVIEWED_AMENDMENT_REQUESTED: "Section Amendment Requested",
  SECTION_REVIEWED_PENDING: "Section Reset to Pending",
  ITEM_REVIEWED_APPROVED: "Item Approved",
  ITEM_REVIEWED_REJECTED: "Item Rejected",
  ITEM_REVIEWED_AMENDMENT_REQUESTED: "Item Amendment Requested",
  ITEM_REVIEWED_PENDING: "Item Reset to Pending",
  CONTRACT_OFFER_SENT: "Facility Offer Sent",
  CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: "Facility Offer Acceptance Submitted",
  CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: "Facility Offer Acceptance Resubmitted",
  CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING: "Facility Acceptance Approved for Signing",
  CONTRACT_OFFER_ACCEPTED: "Facility Offer Accepted",
  CONTRACT_OFFER_REJECTED: "Facility Offer Withdrawn",
  CONTRACT_OFFER_RETRACTED: "Facility Offer Retracted",
  CONTRACT_FACILITY_OCCUPANCY_UPDATED: "Facility Occupancy Updated",
  CONTRACT_OFFER_EXPIRED: "Facility Offer Expired",
  CONTRACT_SIGNING_DEADLINE_EXTENDED: "Signing Deadline Extended",
  CONTRACT_OFFER_DECLINED: "Facility Offer Declined",
  CONTRACT_FACILITY_FEE_WAIVED: "Facility Fee Waived",
  CONTRACT_FACILITY_DISABLED: "Facility Disabled",
  CONTRACT_FACILITY_ENABLED: "Facility Enabled",
  CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED: "Large Private Customer Flag Updated",
  PAYMASTER_CREATED: "Paymaster Created",
  PAYMASTER_LINKED_TO_ISSUER: "Paymaster Linked to Issuer",
  PAYMASTER_VERIFIED: "Paymaster Identity Verified",
  PAYMASTER_IDENTITY_RESOLVED: "Paymaster Identity Resolved",
  SIGNING_PACKAGE_CREATED: "Signing Package Created",
  SIGNING_PACKAGE_SENT: "Signing Package Sent",
  SIGNING_PACKAGE_COMPLETED: "Signing Package Completed",
  SIGNING_PACKAGE_DECLINED: "Signing Package Declined",
  SIGNING_PACKAGE_EXPIRED: "Signing Package Expired",
  SIGNING_PACKAGE_VOIDED: "Signing Package Voided",
  AMENDMENTS_SUBMITTED: "Amendment Request Sent",
  INVOICE_OFFER_ACCEPTED: "Invoice Offer Accepted",
  INVOICE_OFFER_REJECTED: "Invoice Offer Declined",
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
  const metadata = event.metadata;
  const contractReference =
    metadata && typeof metadata.contractReference === "string" && metadata.contractReference.trim()
      ? metadata.contractReference.trim()
      : null;
  const applicationReference =
    metadata &&
    typeof metadata.applicationReference === "string" &&
    metadata.applicationReference.trim()
      ? metadata.applicationReference.trim()
      : null;
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
    targetType: metadata && metadata.contract_id ? "CONTRACT" : undefined,
    targetReference: contractReference ?? applicationReference ?? event.applicationId,
  };
}

export function buildContractActivityCsv(events: AdminContractActivityEvent[]) {
  return buildAdminActivityCsv(events.map(contractEventToActivityCsvRow));
}
