import { formatMoney } from "@cashsouk/ui";
import type { InvoiceProductRules } from "@cashsouk/types";

function formatRm(amount: number): string {
  return `RM ${formatMoney(amount)}`;
}

export function buildInvoiceValueHint(rules: InvoiceProductRules | null): string | undefined {
  if (!rules) return undefined;
  const min = rules.minInvoiceFaceValue;
  const max = rules.maxInvoiceFaceValue;
  if (min != null && max != null) return `Allowed: ${formatRm(min)} – ${formatRm(max)}`;
  if (min != null) return `Min ${formatRm(min)}`;
  if (max != null) return `Max ${formatRm(max)}`;
  return undefined;
}

export function buildFinancingAmountHint(
  rules: InvoiceProductRules | null,
  hasFacility: boolean
): string | undefined {
  if (!rules) return undefined;
  const parts: string[] = [];
  if (rules.minFinancingAmount != null) parts.push(`Min ${formatRm(rules.minFinancingAmount)}`);
  if (rules.maxFinancingAmount != null) parts.push(`Max ${formatRm(rules.maxFinancingAmount)}`);
  if (hasFacility && rules.subLimitPerInvoiceRm != null) {
    parts.push(`Facility sub-limit ${formatRm(rules.subLimitPerInvoiceRm)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function buildInvoiceValueTooltip(rules: InvoiceProductRules | null): string {
  const lines = ["Invoice value is the total face value of the invoice."];
  const limits: string[] = [];
  if (rules?.minInvoiceFaceValue != null) limits.push(`Min ${formatRm(rules.minInvoiceFaceValue)}`);
  if (rules?.maxInvoiceFaceValue != null) limits.push(`Max ${formatRm(rules.maxInvoiceFaceValue)}`);
  if (limits.length > 0) {
    lines.push(`Allowed invoice value:\n${limits.join("\n")}`);
  }
  return lines.join("\n\n");
}
