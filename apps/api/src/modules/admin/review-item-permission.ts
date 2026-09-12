import {
  getSectionForPendingAmendment,
  type AdminPermission,
  type ReviewItemType,
  type ReviewSection,
} from "@cashsouk/types";

/** Item-action permission matching the section manage map used by review section routes. */
export function getApplicationItemManagePermission(itemType: ReviewItemType): AdminPermission {
  if (itemType === "invoice") return "applications.invoice.manage";
  return "applications.documents.manage";
}

/** Section-action permission used by review section routes. */
export function getApplicationSectionManagePermission(section: string): AdminPermission | null {
  switch (section as ReviewSection | "business_guarantor") {
    case "financial":
      return "applications.financial.manage";
    case "business_details":
    case "business_guarantor":
      return "applications.business_guarantor.manage";
    case "supporting_documents":
    case "acceptance_documents":
      return "applications.documents.manage";
    case "contract_details":
      return "applications.contract.manage";
    case "invoice_details":
      return "applications.invoice.manage";
    case "company_details":
      return "applications.company.manage";
    default:
      return null;
  }
}

export function getPendingAmendmentCreatePermission(input: {
  scope: "section" | "item";
  scopeKey?: string;
  itemType?: ReviewItemType;
}): AdminPermission | null {
  if (input.scope === "item") {
    if (!input.itemType) return null;
    return getApplicationItemManagePermission(input.itemType);
  }
  if (!input.scopeKey) return null;
  return getApplicationSectionManagePermission(input.scopeKey);
}

export function getPendingAmendmentRoutePermission(
  scope: string,
  scopeKey: string
): AdminPermission | null {
  return getApplicationSectionManagePermission(getSectionForPendingAmendment(scope, scopeKey));
}
