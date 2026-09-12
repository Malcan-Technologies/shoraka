/**
 * Acceptance-hub review items (authorised parties + acceptance documents).
 * Underwriting invoices/supporting docs use other prefixes and must not appear
 * in the Offer & acceptance issuer-response amendments list.
 */

export function isAcceptanceHubReviewItem(item: {
  item_type?: string | null;
  item_id?: string | null;
}): boolean {
  const itemId = item.item_id ?? "";
  if (itemId.startsWith("acceptance_documents:") || itemId.startsWith("authorized_representatives:")) {
    return true;
  }
  return item.item_type === "authorized_representatives";
}
