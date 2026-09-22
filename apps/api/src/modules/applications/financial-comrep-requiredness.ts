import {
  APPLICATION_COMREP_DETAIL_KEYS,
  FINANCIAL_FIELD_LABELS,
  APPLICATION_COMREP_OPTIONAL_KEYS,
  isIssuerFinancialFieldRequired,
  type ApplicationComrepDetailKey,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";

function isBlankOrNonFinite(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return !Number.isFinite(value);
  return false;
}

export function assertRequiredFinancialComrepFieldsPresentOrThrow(block: Record<string, unknown>): void {
  // Enforce "must be provided" for SC-required columns.
  // The SC manual explicitly marks a subset as "(if applicable)" — those remain optional.
  for (const key of APPLICATION_COMREP_DETAIL_KEYS as readonly ApplicationComrepDetailKey[]) {
    // Prefer the canonical helper to determine SC required-vs-(if applicable).
    if (!isIssuerFinancialFieldRequired(key)) continue;

    const val = block[key as string];
    if (isBlankOrNonFinite(val)) {
      const label = FINANCIAL_FIELD_LABELS[key as string] ?? String(key);
      throw new AppError(400, "VALIDATION_ERROR", `${label} is required.`);
    }
  }

  // Keep lint happy (these constants are used indirectly via helper predicates).
  void APPLICATION_COMREP_OPTIONAL_KEYS;
}

