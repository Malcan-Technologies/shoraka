export type AdminActivityCsvRow = {
  createdAt: string;
  event: string;
  eventType: string;
  actor: string;
  actorUserId: string;
  portal: string;
  remark: string;
  metadata: Record<string, unknown> | null;
};

export const ADMIN_ACTIVITY_CSV_HEADERS = [
  "createdAt",
  "event",
  "eventType",
  "actor",
  "actorUserId",
  "portal",
  "remark",
  "metadata",
] as const;

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function metadataCell(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return JSON.stringify(metadata);
}

export function mergeActivityCsvMetadata(
  base: Record<string, unknown> | null | undefined,
  extra: Record<string, unknown>
): Record<string, unknown> | null {
  const extras = Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value != null && value !== "")
  );
  if (!base && Object.keys(extras).length === 0) return null;
  return { ...(base ?? {}), ...extras };
}

export function buildAdminActivityCsv(rows: AdminActivityCsvRow[]): string {
  const lines = [
    [...ADMIN_ACTIVITY_CSV_HEADERS],
    ...rows.map((row) => [
      row.createdAt,
      row.event,
      row.eventType,
      row.actor,
      row.actorUserId,
      row.portal,
      row.remark,
      metadataCell(row.metadata),
    ]),
  ];
  return lines.map((line) => line.map(csvCell).join(",")).join("\n");
}

export function downloadAdminActivityCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
