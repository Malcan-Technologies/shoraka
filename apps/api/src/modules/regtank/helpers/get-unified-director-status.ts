/**
 * SECTION: Unified director status readers
 * WHY: Read issuer or supplement status using one interface
 * INPUT: issuer org object OR CTOS supplement object
 * OUTPUT: issuer status first, fallback to supplement normalized, else null
 * WHERE USED: API/UI read layer composition
 */
type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read unified KYC status.
 *
 * Usage:
 * const kyc = getUnifiedKyc(orgOrSupplement);
 */
export function getUnifiedKyc(source: unknown): UnknownRecord | null {
  if (!isObject(source)) return null;

  const issuerKyc = source.director_kyc_status;
  if (issuerKyc) return issuerKyc as UnknownRecord;

  const onboardingJson = source.onboarding_json;
  if (!isObject(onboardingJson)) return null;

  const screening = isObject(onboardingJson.screening)
    ? (onboardingJson.screening as UnknownRecord)
    : null;
  const flatNorm = screening?.normalized;
  if (isObject(flatNorm)) return flatNorm as UnknownRecord;

  const nestedKyc =
    screening && isObject((screening as { kyc?: unknown }).kyc)
      ? ((screening as { kyc: UnknownRecord }).kyc as UnknownRecord)
      : null;
  const legacyKyc = nestedKyc ?? onboardingJson.kyc;
  if (isObject(legacyKyc)) {
    const normalized = (legacyKyc as UnknownRecord).normalized;
    if (isObject(normalized)) return normalized as UnknownRecord;
  }

  return null;
}

/**
 * Read unified AML status.
 *
 * Usage:
 * const aml = getUnifiedAml(orgOrSupplement);
 */
export function getUnifiedAml(source: unknown): UnknownRecord | null {
  if (!isObject(source)) return null;

  const issuerAml = source.director_aml_status;
  if (issuerAml) return issuerAml as UnknownRecord;

  const onboardingJson = source.onboarding_json;
  if (!isObject(onboardingJson)) return null;

  const screening = isObject(onboardingJson.screening)
    ? (onboardingJson.screening as UnknownRecord)
    : null;
  const flatNorm = screening?.normalized;
  if (isObject(flatNorm)) return flatNorm as UnknownRecord;

  const nestedAml =
    screening && isObject((screening as { aml?: unknown }).aml)
      ? ((screening as { aml: UnknownRecord }).aml as UnknownRecord)
      : null;
  const legacyAml = nestedAml ?? onboardingJson.aml;
  if (isObject(legacyAml)) {
    const normalized = (legacyAml as UnknownRecord).normalized;
    if (isObject(normalized)) return normalized as UnknownRecord;
  }

  return null;
}

