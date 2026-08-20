import { formatApplicationReference, formatInvoiceReference } from "@cashsouk/types";

export const ISSUER_APPLICATIONS_SEARCH_PLACEHOLDER =
  "Reference, customer, or invoice number";

export type ApplicationListSearchInvoice = {
  id: string;
  number: string;
  displayReference?: string | null;
};

export type ApplicationListSearchItem = {
  id: string;
  displayReference?: string | null;
  customer: string;
  invoices: ApplicationListSearchInvoice[];
};

function compactRef(value: string): string {
  return value.replace(/-/g, "");
}

/** Visible identifiers plus paste variants (hyphens, short id, invoice refs). */
export function applicationListSearchHaystack(app: ApplicationListSearchItem): string {
  const invoiceParts = app.invoices.flatMap((inv) => [
    inv.id,
    inv.number,
    inv.displayReference ?? "",
    formatInvoiceReference({
      id: inv.id,
      displayReference: inv.displayReference,
      businessNumber: inv.number,
    }),
  ]);

  return [
    app.id,
    app.displayReference ?? "",
    formatApplicationReference({ id: app.id, displayReference: app.displayReference }),
    app.customer,
    ...invoiceParts,
  ]
    .join(" ")
    .toLowerCase();
}

export function applicationMatchesListSearch(
  app: ApplicationListSearchItem,
  rawQuery: string
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = applicationListSearchHaystack(app);
  if (haystack.includes(q)) return true;
  return compactRef(haystack).includes(compactRef(q));
}
