import { requiredNumberIssue, type ComrepFieldIssue } from "./comrep-requiredness";

/** People/Profile hard floor for active shareholders (issuer and investor; individual and company). */
export const ISSUER_MIN_SHAREHOLDING_PERCENT = 5;

export const ISSUER_MIN_SHAREHOLDING_MESSAGE = "Shareholding Percentage must be at least 5%.";

export const SHAREHOLDING_MAX_PERCENT = 100;

export const SHAREHOLDING_MAX_MESSAGE = "Enter a percentage of 100 or less.";

export const ISSUER_SHAREHOLDING_RANGE_MESSAGE = "Enter a percentage between 5 and 100.";

const SHARE_LABEL = "Shareholding Percentage (%)";

export function parseShareholdingPercent(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/%/g, "").replace(/,/g, "");
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    return parseShareholdingPercent(String(value));
  }
  return null;
}

export function issuerShareholdingMeetsMinimum(value: unknown): boolean {
  const n = parseShareholdingPercent(value);
  return n != null && n >= ISSUER_MIN_SHAREHOLDING_PERCENT;
}

export function issuerShareholdingThresholdIssue(
  value: unknown,
  options?: { required?: boolean }
): ComrepFieldIssue | null {
  const required = options?.required !== false;
  const parsed = parseShareholdingPercent(value);
  if (parsed == null) {
    if (!required && (value == null || value === "")) return null;
    return requiredNumberIssue(
      parsed == null && (typeof value === "string" || typeof value === "number" || value == null)
        ? value
        : "",
      "shareholdingPercentage",
      SHARE_LABEL
    );
  }
  if (parsed < ISSUER_MIN_SHAREHOLDING_PERCENT) {
    return {
      field: "shareholdingPercentage",
      label: SHARE_LABEL,
      message: ISSUER_MIN_SHAREHOLDING_MESSAGE,
    };
  }
  if (parsed > SHAREHOLDING_MAX_PERCENT) {
    return {
      field: "shareholdingPercentage",
      label: SHARE_LABEL,
      message: ISSUER_SHAREHOLDING_RANGE_MESSAGE,
    };
  }
  return null;
}

export function shareholdingPercentCapIssue(
  value: unknown,
  field = "shareholdingPercentage",
  label = SHARE_LABEL
): ComrepFieldIssue | null {
  const parsed = parseShareholdingPercent(value);
  if (parsed == null || parsed <= SHAREHOLDING_MAX_PERCENT) return null;
  return { field, label, message: SHAREHOLDING_MAX_MESSAGE };
}

export function isIssuerShareholderOnlyBelowMinimum(flags: {
  isShareholder: boolean;
  isDirector?: boolean;
  isBoard?: boolean;
  isManagement?: boolean;
  shareholdingPercentage: unknown;
}): boolean {
  if (!flags.isShareholder) return false;
  if (flags.isDirector || flags.isBoard || flags.isManagement) return false;
  return !issuerShareholdingMeetsMinimum(flags.shareholdingPercentage);
}

export function issuerActiveShareholderFlags(flags: {
  isShareholder: boolean;
  isDirector?: boolean;
  isBoard?: boolean;
  isManagement?: boolean;
  shareholdingPercentage: unknown;
}): { isShareholder: boolean; shareholdingPercentage: unknown } {
  if (!flags.isShareholder) {
    return { isShareholder: false, shareholdingPercentage: flags.shareholdingPercentage };
  }
  if (issuerShareholdingMeetsMinimum(flags.shareholdingPercentage)) {
    return { isShareholder: true, shareholdingPercentage: flags.shareholdingPercentage };
  }
  return { isShareholder: false, shareholdingPercentage: null };
}
