export type AttentionFinancingKind = "facility" | "invoice";

export const ATTENTION_KIND_LABELS = {
  facility: "Facility",
  invoice: "Invoice",
} as const;

export function attentionKindFromApplicationType(
  type: "Facility financing" | "Invoice financing" | "Generic"
): AttentionFinancingKind | null {
  if (type === "Facility financing") return "facility";
  if (type === "Invoice financing") return "invoice";
  return null;
}
