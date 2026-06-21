import { AppError } from "../../lib/http/error-handler";
import { normalizeEkycLegalName } from "./resolve-issuer-ekyc-identity";

/** Normalize user-confirmed MyKad name for SigningCloud submitResult (not persisted on org). */
export function parseConfirmedEkycName(confirmedName?: string): string | null {
  const rawName = confirmedName?.trim() ?? "";
  if (!rawName) {
    return null;
  }

  const name = normalizeEkycLegalName(rawName);
  if (!name) {
    throw new AppError(400, "VALIDATION_ERROR", "Full name is required");
  }

  return name;
}
