import type { InvoiceFormModel } from "@/app/(application-flow)/applications/components/invoice-form-fields";

export function isInvoiceFormRowEmpty(inv: InvoiceFormModel): boolean {
  return !inv.number && inv.value === "" && !inv.maturity_date && !inv.document;
}

export function invoiceRowHasRequiredFields(
  inv: InvoiceFormModel,
  hasPendingFile = false
): boolean {
  const hasNumber = Boolean(String(inv.number).trim());
  const hasValue = inv.value !== "";
  const hasDate = Boolean(String(inv.maturity_date).trim());
  const hasTenure = inv.financing_tenure_days != null;
  const hasDocument = Boolean(inv.document) || hasPendingFile;
  return hasNumber && hasValue && hasDate && hasTenure && hasDocument;
}

export function isInvoiceFormRowPartial(
  inv: InvoiceFormModel,
  hasPendingFile = false
): boolean {
  if (isInvoiceFormRowEmpty(inv)) return false;
  return !invoiceRowHasRequiredFields(inv, hasPendingFile);
}

/**
 * Presence-only gate for Save and Continue.
 * Date/tenure/amount/ratio constraints are checked on save, not here — otherwise the
 * footer stays disabled with no field errors (those render only after a save attempt).
 */
export function isInvoiceStepContinueReady(input: {
  invoices: InvoiceFormModel[];
  hasPendingFile: (invoiceId: string) => boolean;
  requiresInvoice: boolean;
  requiresFacilityFeePayment: boolean;
}): boolean {
  if (input.requiresFacilityFeePayment) return false;
  if (
    input.invoices.some((inv) =>
      isInvoiceFormRowPartial(inv, input.hasPendingFile(inv.id))
    )
  ) {
    return false;
  }
  if (!input.requiresInvoice) return true;
  return input.invoices.some(
    (inv) =>
      !isInvoiceFormRowEmpty(inv) &&
      invoiceRowHasRequiredFields(inv, input.hasPendingFile(inv.id))
  );
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
