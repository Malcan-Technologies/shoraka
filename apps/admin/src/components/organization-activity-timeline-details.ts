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

  return details;
}
