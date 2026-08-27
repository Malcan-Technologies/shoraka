export type OrganizationTimelineBylineChip = {
  label: string;
  name: string;
};

export type OrganizationTimelineCompactDetail = {
  label: string;
  value: string;
};

const BYLINE_FIELDS = [
  { idKey: "approvedBy", nameKey: "approvedByName", label: "Approved by" },
  { idKey: "cancelledBy", nameKey: "cancelledByName", label: "Cancelled by" },
  { idKey: "updatedBy", nameKey: "updatedByName", label: "Updated by" },
  { idKey: "resetBy", nameKey: "resetByName", label: "Reset by" },
] as const;

export function extractOrganizationTimelineBylineChips(
  metadata: Record<string, unknown> | null
): OrganizationTimelineBylineChip[] {
  if (!metadata) return [];

  const chips: OrganizationTimelineBylineChip[] = [];
  for (const field of BYLINE_FIELDS) {
    const actorId = metadata[field.idKey];
    if (actorId == null || actorId === "") continue;
    const resolvedName = metadata[field.nameKey];
    chips.push({
      label: field.label,
      name:
        typeof resolvedName === "string" && resolvedName.trim() ? resolvedName.trim() : "Admin",
    });
  }
  return chips;
}

export function extractOrganizationTimelineCompactDetails(
  _eventType: string,
  metadata: Record<string, unknown> | null
): OrganizationTimelineCompactDetail[] {
  if (!metadata) return [];

  const details: OrganizationTimelineCompactDetail[] = [];

  if (metadata.previousStatus && metadata.newStatus) {
    details.push({
      label: "Status",
      value: `${String(metadata.previousStatus)} → ${String(metadata.newStatus)}`,
    });
  } else if (metadata.newStatus) {
    details.push({ label: "Status", value: String(metadata.newStatus) });
  }

  if (metadata.riskLevel) {
    details.push({ label: "Risk", value: String(metadata.riskLevel) });
  }
  if (metadata.riskScore) {
    details.push({ label: "Score", value: String(metadata.riskScore) });
  }

  if (metadata.organizationReference) {
    details.push({ label: "Organisation", value: String(metadata.organizationReference) });
  }
  if (metadata.memberEmail) {
    details.push({ label: "Member", value: String(metadata.memberEmail) });
  }
  if (metadata.previousRole && metadata.newRole) {
    details.push({
      label: "Role",
      value: `${String(metadata.previousRole)} → ${String(metadata.newRole)}`,
    });
  } else if (metadata.newRole) {
    details.push({ label: "Role", value: String(metadata.newRole) });
  } else if (metadata.previousRole) {
    details.push({ label: "Previous role", value: String(metadata.previousRole) });
  }

  if (_eventType === "MARC_ASSESSMENT_SAVED") {
    const previous =
      metadata.previousValues &&
      typeof metadata.previousValues === "object" &&
      !Array.isArray(metadata.previousValues)
        ? (metadata.previousValues as Record<string, unknown>)
        : null;
    const next =
      metadata.nextValues && typeof metadata.nextValues === "object" && !Array.isArray(metadata.nextValues)
        ? (metadata.nextValues as Record<string, unknown>)
        : null;
    const previousGrade = previous && typeof previous.creditGrade === "string" ? previous.creditGrade : null;
    const nextGrade = next && typeof next.creditGrade === "string" ? next.creditGrade : null;
    if (previousGrade && nextGrade) {
      details.push({ label: "Credit grade", value: `${previousGrade} → ${nextGrade}` });
    } else if (nextGrade) {
      details.push({ label: "Credit grade", value: nextGrade });
    }
  }

  return details;
}

export function organizationLogTargetReference(
  log: {
    target_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): string {
  const metadata = log.metadata;
  const organizationReference =
    metadata && typeof metadata.organizationReference === "string"
      ? metadata.organizationReference.trim()
      : "";
  if (organizationReference) return organizationReference;
  return log.target_id ?? "";
}
