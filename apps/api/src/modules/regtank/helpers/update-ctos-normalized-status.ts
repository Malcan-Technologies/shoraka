/**
 * SECTION: CTOS supplement normalized status updates
 * WHY: Keep screening.kyc / screening.aml normalized blocks aligned with issuer shape
 * INPUT: onboarding_json + raw webhook status + match identifiers
 * OUTPUT: merged document with `screening` only (legacy kyc/aml stripped)
 * WHERE USED: RegTank CTOS supplement webhook handlers
 */
import { getEffectiveCtosPartyScreening } from "@cashsouk/types";

type JsonObject = Record<string, unknown>;

type MatchIdentifiers = {
  kycId?: string | null;
  eodRequestId?: string | null;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject | null {
  return isObject(value) ? { ...value } : null;
}

function normalizedValue(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEntryMatch(entry: JsonObject, ids: MatchIdentifiers): boolean {
  const entryKycId = normalizedValue(entry.kycId);
  const entryEodRequestId = normalizedValue(entry.eodRequestId);

  const targetKycId = normalizedValue(ids.kycId);
  if (targetKycId && entryKycId === targetKycId) return true;

  const targetEodRequestId = normalizedValue(ids.eodRequestId);
  if (targetEodRequestId && entryEodRequestId === targetEodRequestId) return true;

  return false;
}

function updateKycNormalized(
  normalized: JsonObject,
  status: string,
  now: string,
  ids: MatchIdentifiers
): { normalized: JsonObject; changed: boolean } {
  const directors = Array.isArray(normalized.directors) ? normalized.directors : null;
  if (!directors) {
    return { normalized, changed: false };
  }

  let changed = false;
  const updatedDirectors = directors.map((director) => {
    if (!isObject(director)) return director;
    if (!isEntryMatch(director, ids)) return director;

    changed = true;
    const existingKycRequestInfo = asObject(director.kycRequestInfo) ?? {};
    return {
      ...director,
      kycStatus: status,
      kycRequestInfo: {
        ...existingKycRequestInfo,
        status,
      },
      lastUpdated: now,
    };
  });

  if (!changed) {
    return { normalized, changed: false };
  }

  return {
    normalized: {
      ...normalized,
      directors: updatedDirectors,
      lastSyncedAt: now,
    },
    changed: true,
  };
}

function updateAmlNormalized(
  normalized: JsonObject,
  status: string,
  now: string,
  ids: MatchIdentifiers
): { normalized: JsonObject; changed: boolean } {
  let changed = false;

  const updateArray = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    return value.map((entry) => {
      if (!isObject(entry)) return entry;
      if (!isEntryMatch(entry, ids)) return entry;
      changed = true;
      return {
        ...entry,
        amlStatus: status,
        lastUpdated: now,
      };
    });
  };

  const nextDirectors = updateArray(normalized.directors);
  const nextIndividualShareholders = updateArray(normalized.individualShareholders);
  const nextBusinessShareholders = updateArray(normalized.businessShareholders);

  if (!changed) {
    return { normalized, changed: false };
  }

  return {
    normalized: {
      ...normalized,
      directors: nextDirectors,
      individualShareholders: nextIndividualShareholders,
      businessShareholders: nextBusinessShareholders,
      lastSyncedAt: now,
    },
    changed: true,
  };
}

export function updateCtosSupplementNormalizedStatus(params: {
  onboardingJson: JsonObject;
  status: string;
  now: string;
  identifiers: MatchIdentifiers;
}): JsonObject {
  const { onboardingJson, status, now, identifiers } = params;

  const next = { ...onboardingJson };
  const eff = getEffectiveCtosPartyScreening(next);
  let kycBlock = { ...eff.kyc };
  let amlBlock = { ...eff.aml };

  const existingKyc = asObject(kycBlock);
  if (existingKyc) {
    const existingKycNormalized = asObject(existingKyc.normalized);
    if (existingKycNormalized) {
      const kycResult = updateKycNormalized(existingKycNormalized, status, now, identifiers);
      if (kycResult.changed) {
        kycBlock = {
          ...existingKyc,
          normalized: kycResult.normalized,
        };
      }
    }
  }

  const existingAml = asObject(amlBlock);
  if (existingAml) {
    const existingAmlNormalized = asObject(existingAml.normalized);
    if (existingAmlNormalized) {
      const amlResult = updateAmlNormalized(existingAmlNormalized, status, now, identifiers);
      if (amlResult.changed) {
        amlBlock = {
          ...existingAml,
          normalized: amlResult.normalized,
        };
      }
    }
  }

  next.screening = {
    provider: eff.provider,
    kyc: kycBlock,
    aml: amlBlock,
  };
  delete next.kyc;
  delete next.aml;

  return next;
}
