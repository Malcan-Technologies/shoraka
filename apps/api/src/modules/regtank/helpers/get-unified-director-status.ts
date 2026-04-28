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

  const kyc = onboardingJson.kyc;
  if (!isObject(kyc)) return null;

  const normalized = kyc.normalized;
  if (isObject(normalized)) return normalized;

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

  const aml = onboardingJson.aml;
  if (!isObject(aml)) return null;

  const normalized = aml.normalized;
  if (isObject(normalized)) return normalized;

  return null;
}

