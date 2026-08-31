import { formatNamedEntityDisplay, type PaymasterActivityEvent } from "@cashsouk/types";
import {
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";
import { formatAuditEventLabel } from "@/components/audit/audit-presentation";

export function paymasterActivityToCsvRow(event: PaymasterActivityEvent): AdminActivityCsvRow {
  const issuer = formatNamedEntityDisplay(event.issuerName, event.issuerDisplayReference);
  return {
    createdAt: event.createdAt,
    event: formatAuditEventLabel(event.eventType),
    eventType: event.eventType,
    actor: event.actorName ?? "",
    actorUserId: event.actorUserId ?? "",
    portal: event.portal ?? "",
    remark: event.remark ?? "",
    metadata: mergeActivityCsvMetadata(event.metadata, {
      paymasterId: event.paymasterId,
      issuerOrganizationId: event.issuerOrganizationId,
      applicationId: event.applicationId,
    }),
    organisation: issuer === "—" ? null : issuer,
    targetType: "PAYMASTER",
    targetReference: event.paymasterId,
    status: event.newStatus ?? event.verificationStatus,
    extra: {
      application: event.applicationDisplayReference,
      relatedParty: event.relatedParty == null ? null : event.relatedParty ? "Yes" : "No",
      previousStatus: event.previousStatus,
    },
  };
}
