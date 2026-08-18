import type { OrganizationLinkedRecordRow } from "@cashsouk/types";

export function organizationLinkedRecordHref(
  row: Pick<OrganizationLinkedRecordRow, "type" | "id" | "productId" | "noteId">
): string | null {
  if (row.type === "application") {
    if (!row.productId) return null;
    return `/applications/${encodeURIComponent(row.productId)}/${encodeURIComponent(row.id)}`;
  }
  if (row.type === "contract") {
    return `/contracts/${encodeURIComponent(row.id)}`;
  }
  if (row.type === "note") {
    return `/notes/${encodeURIComponent(row.id)}`;
  }
  if (row.noteId) {
    return `/notes/${encodeURIComponent(row.noteId)}`;
  }
  return null;
}

export function organizationLinkedRecordTypeLabel(
  type: OrganizationLinkedRecordRow["type"]
): string {
  if (type === "application") return "Application";
  if (type === "contract") return "Facility";
  if (type === "note") return "Note";
  return "Investment";
}
