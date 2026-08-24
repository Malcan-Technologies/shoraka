import type { InvoiceFormModel } from "@/app/(application-flow)/applications/components/invoice-form-fields";

export function isInvoiceFormRowEmpty(inv: InvoiceFormModel): boolean {
  return !inv.number && inv.value === "" && !inv.maturity_date && !inv.document;
}

export function hasInvoiceFormRowChanged(
  inv: InvoiceFormModel,
  baseline: InvoiceFormModel | undefined
): boolean {
  if (!inv.isPersisted) return !isInvoiceFormRowEmpty(inv);
  if (!baseline) return false;
  return (
    inv.number !== baseline.number ||
    inv.value !== baseline.value ||
    inv.maturity_date !== baseline.maturity_date ||
    inv.financing_ratio_percent !== baseline.financing_ratio_percent ||
    inv.financing_tenure_days !== baseline.financing_tenure_days ||
    inv.document?.s3_key !== baseline.document?.s3_key
  );
}
