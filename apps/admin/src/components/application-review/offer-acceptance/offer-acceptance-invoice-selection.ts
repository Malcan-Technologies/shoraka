/** Invoice chip ids and other-app selection for the Offer & acceptance tab. */

export const THIS_INVOICE_TAB_PREFIX = "this:";
export const OTHER_INVOICE_TAB_PREFIX = "other:";

export function thisInvoiceTabId(id: string): string {
  return `${THIS_INVOICE_TAB_PREFIX}${id}`;
}

export function otherInvoiceTabId(id: string): string {
  return `${OTHER_INVOICE_TAB_PREFIX}${id}`;
}

export function isOtherInvoiceTabId(tabId: string | null | undefined): boolean {
  return Boolean(tabId?.startsWith(OTHER_INVOICE_TAB_PREFIX));
}

export function parseThisInvoiceTabId(tabId: string | null | undefined): string | null {
  if (!tabId?.startsWith(THIS_INVOICE_TAB_PREFIX)) return null;
  const id = tabId.slice(THIS_INVOICE_TAB_PREFIX.length);
  return id || null;
}

export function parseOtherInvoiceTabId(tabId: string | null | undefined): string | null {
  if (!tabId?.startsWith(OTHER_INVOICE_TAB_PREFIX)) return null;
  const id = tabId.slice(OTHER_INVOICE_TAB_PREFIX.length);
  return id || null;
}

/**
 * Admin application route for an other-app invoice. Omit the link unless both
 * the selected invoice's application id and product id are known.
 */
export function otherInvoiceApplicationHref(input: {
  applicationId?: string | null;
  productId?: string | null;
}): string | null {
  const applicationId = input.applicationId?.trim();
  const productId = input.productId?.trim();
  if (!applicationId || !productId) return null;
  return `/applications/${encodeURIComponent(productId)}/${encodeURIComponent(applicationId)}`;
}

export function resolveThisAppInvoiceIdForStages(input: {
  selectedTabId: string | null;
  thisAppInvoiceIds: readonly string[];
}): string | null {
  if (isOtherInvoiceTabId(input.selectedTabId)) return null;
  const selected = parseThisInvoiceTabId(input.selectedTabId);
  if (selected && input.thisAppInvoiceIds.includes(selected)) return selected;
  return input.thisAppInvoiceIds[input.thisAppInvoiceIds.length - 1] ?? null;
}
