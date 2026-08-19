export function applicationFinancingStructureLabel(
  structureType: string | null | undefined
): string {
  if (structureType === "invoice_only") return "Invoice only";
  if (structureType === "new_contract") return "New facility";
  if (structureType === "existing_contract") return "Existing facility";
  return "—";
}

export function applicationPaymasterName(app: {
  contract?: { customer_details?: Record<string, unknown> | null } | null;
  company_details?: Record<string, unknown> | null;
}): string {
  const customerDetails = app.contract?.customer_details ?? {};
  const companyDetails = app.company_details ?? {};
  const paymaster = String(
    customerDetails.customer_name ??
      customerDetails.name ??
      companyDetails.customer_name ??
      companyDetails.company_name ??
      ""
  ).trim();
  return paymaster || "—";
}
