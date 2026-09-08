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

  if (event.eventType === "PAYMASTER_IDENTITY_UPDATED") {
    const previous =
      event.metadata && typeof event.metadata.previous === "object" && event.metadata.previous
        ? (event.metadata.previous as Record<string, unknown>)
        : {};
    const next =
      event.metadata && typeof event.metadata.new === "object" && event.metadata.new
        ? (event.metadata.new as Record<string, unknown>)
        : {};
    const pushDiff = (key: string, label: string) => {
      const from = typeof previous[key] === "string" ? previous[key].trim() : "";
      const to = typeof next[key] === "string" ? next[key].trim() : "";
      if (from && to && from !== to) rows.push({ key, label, value: `${from} → ${to}` });
    };
    pushDiff("legalName", "Legal name");
    pushDiff("country", "Country");
    pushDiff("entityType", "Entity type");
    return rows;
  }

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

  if (event.eventType === "PAYMASTER_IDENTITY_SYNCED") {
    const previous =
      event.metadata && typeof event.metadata.previous === "object" && event.metadata.previous
        ? (event.metadata.previous as Record<string, unknown>)
        : {};
    const next =
      event.metadata && typeof event.metadata.new === "object" && event.metadata.new
        ? (event.metadata.new as Record<string, unknown>)
        : {};
    const pushDiff = (key: string, label: string) => {
      const from = typeof previous[key] === "string" ? previous[key].trim() : "";
      const to = typeof next[key] === "string" ? next[key].trim() : "";
      if (from !== to && (from || to)) rows.push({ key, label, value: `${from} → ${to}` });
    };
    pushDiff("name", "Customer Name");
    pushDiff("country", "Customer Country");
    pushDiff("entity_type", "Customer Entity Type");
    pushDiff("ssm_number", "Customer SSM Number");
    rows.push({
      key: "source",
      label: "Source",
      value: "Official Paymaster identity updated",
    });
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
