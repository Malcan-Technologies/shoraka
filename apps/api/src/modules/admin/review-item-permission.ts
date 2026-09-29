import {
  getSectionForPendingAmendment,
  getSectionForScopeKey,
  type AdminPermission,
  type ReviewItemType,
  type ReviewSection,
} from "@cashsouk/types";

const OFFER_ACCEPTANCE_MANAGE: AdminPermission = "applications.offer_acceptance.manage";

/**
 * Item-action permission matching the section manage map used by review section routes.
 * Offer & Acceptance items (invoices, authorized representatives, acceptance documents)
 * use applications.offer_acceptance.manage; Supporting Documents items keep
 * applications.documents.manage. `itemId` is the item scope key
 * ("acceptance_documents:<index>:<name>", "supporting_documents:...").
 */
export function getApplicationItemManagePermission(
  itemType: ReviewItemType,
  itemId?: string
): AdminPermission {
  if (itemType === "invoice" || itemType === "authorized_representatives") {
    return OFFER_ACCEPTANCE_MANAGE;
  }
  if (itemId && getSectionForScopeKey(itemId) === "acceptance_documents") {
    return OFFER_ACCEPTANCE_MANAGE;
  }
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
      return "applications.documents.manage";
    case "acceptance_documents":
    case "contract_details":
    case "invoice_details":
      return OFFER_ACCEPTANCE_MANAGE;
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
    return getApplicationItemManagePermission(input.itemType, input.scopeKey);
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
