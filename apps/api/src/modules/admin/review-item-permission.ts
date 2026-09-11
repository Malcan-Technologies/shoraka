import type { AdminPermission, ReviewItemType } from "@cashsouk/types";

/** Item-action permission matching the section manage map used by review section routes. */
export function getApplicationItemManagePermission(itemType: ReviewItemType): AdminPermission {
  if (itemType === "invoice") return "applications.invoice.manage";
  return "applications.documents.manage";
}
