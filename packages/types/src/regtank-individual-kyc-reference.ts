/**
 * Individual RegTank KYC reference validation.
 *
 * RegTank can return individual KYC requestIds starting with:
 * - "KYC" (Acuris KYC)
 * - "DJKYC" (Dow Jones KYC)
 *
 * This helper intentionally centralizes the prefix semantics so other
 * lifecycle/status/refresh logic does not duplicate it.
 */

export function isIndividualKycReference(id: unknown): boolean {
  if (id == null) return false;
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  return upper.startsWith("KYC") || upper.startsWith("DJKYC");
}

