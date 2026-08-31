import { formatNamedEntityDisplay, type PaymasterActivityEvent } from "@cashsouk/types";

function issuerLabel(event: PaymasterActivityEvent): string | null {
  if (!event.issuerName && !event.issuerDisplayReference) return null;
  const label = formatNamedEntityDisplay(event.issuerName, event.issuerDisplayReference);
  return label === "—" ? null : label;
}

export function paymasterActivityDescription(event: PaymasterActivityEvent): string | null {
  const issuer = issuerLabel(event);
  const application = event.applicationDisplayReference?.trim() || null;

  if (event.eventType === "PAYMASTER_CREATED") {
    if (issuer && application) return `Created from ${issuer} application ${application}.`;
    if (issuer) return `Created from ${issuer} application.`;
    if (application) return `Created from application ${application}.`;
    return event.remark;
  }

  if (event.eventType === "PAYMASTER_LINKED_TO_ISSUER") {
    return issuer || event.remark;
  }

  return event.remark;
}

export function paymasterActivityCompactDetails(
  event: PaymasterActivityEvent
): { key: string; label: string; value: string }[] {
  const rows: { key: string; label: string; value: string }[] = [];

  if (event.eventType === "PAYMASTER_VERIFIED") {
    if (event.previousStatus && event.newStatus) {
      rows.push({
        key: "status",
        label: "Status",
        value: `${event.previousStatus} → ${event.newStatus}`,
      });
    } else if (event.verificationStatus) {
      rows.push({ key: "status", label: "Status", value: event.verificationStatus });
    }
    return rows;
  }

  if (event.eventType === "PAYMASTER_CREATED" && event.verificationStatus) {
    rows.push({ key: "status", label: "Status", value: event.verificationStatus });
  }

  if (event.relatedParty != null) {
    rows.push({
      key: "relatedParty",
      label: "Related party",
      value: event.relatedParty ? "Yes" : "No",
    });
  }

  return rows;
}
