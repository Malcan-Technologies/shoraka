/**
 * SC ComRep RMO-P2P Reporting Manual, Part B §2 General Information.
 * Only formatting the manual states: no dash, space, or special characters
 * for ROC/BRN (2.3) and NRIC (2.4). Do not interchange BRN and ROC.
 */

export function normalizeScRegistrationNumber(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const normalized = value.replace(/[^A-Za-z0-9]/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function normalizeScNric(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.replace(/[^A-Za-z0-9]/g, "");
  return normalized.length > 0 ? normalized : null;
}

/** SC [02000] share-count columns: "Integer value without decimal points." */
export function isScIntegerWithoutDecimal(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "number") return Number.isInteger(value);
  if (typeof value === "string") return /^\d+$/.test(value.trim());
  return false;
}

export function omitRecordId<T extends Record<string, unknown>>(
  value: T
): Omit<T, "id"> {
  const { id: _id, ...rest } = value;
  return rest;
}

/** Strict body for operator child records: known keys only; empty strings become null. */
export function pickKnownKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === "id" || !(key in value)) continue;
    const raw = value[key];
    out[key] = raw === "" ? null : raw;
  }
  return out;
}

export const OPERATOR_SHARE_CAPITAL_SDN_BHD_KEYS = [
  "ordinaryUnits",
  "ordinaryAmount",
  "preferenceUnits",
  "preferenceAmount",
  "othersUnits",
  "othersAmount",
  "totalPaidUpCapital",
] as const;

export const OPERATOR_SHARE_CAPITAL_LLP_KEYS = [
  "llpMembersCapitalUnits",
  "llpMembersCapitalAmount",
  "llpMembersReservesUnits",
  "llpMembersReservesAmount",
  "llpSubordinatedLoansUnits",
  "llpSubordinatedLoansAmount",
  "totalLlp",
] as const;

export const OPERATOR_SHARE_CAPITAL_PATCH_KEYS = [
  ...OPERATOR_SHARE_CAPITAL_SDN_BHD_KEYS,
  ...OPERATOR_SHARE_CAPITAL_LLP_KEYS,
] as const;

export type OperatorShareCapitalPatchKey = (typeof OPERATOR_SHARE_CAPITAL_PATCH_KEYS)[number];

export function toOperatorShareCapitalPatch(
  value: Record<string, unknown> | null | undefined,
  kind?: "SDN_BHD" | "LLP" | null
): Partial<Record<OperatorShareCapitalPatchKey, unknown>> {
  const src = value ?? {};
  const keys =
    kind === "SDN_BHD"
      ? OPERATOR_SHARE_CAPITAL_SDN_BHD_KEYS
      : kind === "LLP"
        ? OPERATOR_SHARE_CAPITAL_LLP_KEYS
        : OPERATOR_SHARE_CAPITAL_PATCH_KEYS;
  const out: Partial<Record<OperatorShareCapitalPatchKey, unknown>> = {};
  for (const key of keys) {
    if (key in src) out[key] = src[key];
  }
  return out;
}
