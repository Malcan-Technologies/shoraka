import { ctosPositionDirectorShareholderFlags } from "./ctos-position-roles";

/**
 * SECTION: Detect onboarding gaps for CTOS individuals
 * WHY: Show admin what is new, in-progress, or incomplete
 * INPUT: ctos + issuer + supplement objects
 * OUTPUT: { newRequired, inProgress, kycIssues, amlIssues }
 * WHERE USED: Admin read-only visibility layer
 */
type UnknownRecord = Record<string, unknown>;

type GapInput = {
  ctos?: unknown;
  issuer?: unknown;
  supplement?: unknown;
};

type CtosIndividualType = "DIRECTOR" | "SHAREHOLDER";
type CtosEntityType = "INDIVIDUAL" | "CORPORATE";

type CtosIndividual = {
  matchKey: string;
  governmentIdNumber: string;
  name: string | null;
  email: string | null;
  type: CtosIndividualType;
  entityType: CtosEntityType;
  sharePercentage: number | null;
};

type NewRequiredIssue = {
  type: "NEW_REQUIRED";
  matchKey: string;
  governmentIdNumber: string;
  name: string | null;
  email: string | null;
  role: CtosIndividualType;
};

type InProgressIssue = {
  type: "IN_PROGRESS";
  matchKey: string;
  governmentIdNumber: string;
  name: string | null;
  status: string | null;
};

type KycIssue = {
  type: "KYC_INCOMPLETE";
  matchKey: string;
  governmentIdNumber: string;
  issuerStatus: string | null;
};

type AmlIssue = {
  type: "AML_INCOMPLETE";
  matchKey: string;
  governmentIdNumber: string;
  amlStatus: string | null;
};

export type DetectDirectorGapsResult = {
  newRequired: NewRequiredIssue[];
  inProgress: InProgressIssue[];
  kycIssues: KycIssue[];
  amlIssues: AmlIssue[];
};

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeId(id?: string | null): string | null {
  if (!id || typeof id !== "string") return null;
  const normalized = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function getCtosId(x: unknown): string | null {
  if (!isObject(x)) return null;
  const partyType = typeof x.party_type === "string" ? x.party_type.trim().toUpperCase() : "";
  if (partyType === "I") {
    const id = x.nic_brno;
    if (typeof id !== "string" || !id.trim()) return null;
    const normalized = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }
  if (partyType === "C") {
    const id = typeof x.ic_lcno === "string" && x.ic_lcno.trim() ? x.ic_lcno : x.brn_ssm;
    if (typeof id !== "string" || !id.trim()) return null;
    const normalized = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
}

function getCtosEntityType(x: UnknownRecord): CtosEntityType | null {
  const partyType = typeof x.party_type === "string" ? x.party_type.trim().toUpperCase() : "";
  if (partyType === "I") return "INDIVIDUAL";
  if (partyType === "C") return "CORPORATE";
  return null;
}

function normalizeIdValue(raw: string): string | null {
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/** CTOS `equity_percentage` only; 0–1 → percent scale. */
function parseCtosEquityPercentage(value: unknown): number | null {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
}

export function extractCtosIndividuals(ctos: unknown): CtosIndividual[] {
  if (!isObject(ctos)) return [];

  const individuals: CtosIndividual[] = [];

  const pushIndividual = (
    person: UnknownRecord,
    name: unknown,
    email: unknown,
    type: CtosIndividualType,
    sharePercentage: number | null
  ): void => {
    const entityType = getCtosEntityType(person);
    if (!entityType) return;
    const matchKey = getCtosId(person);
    const governmentIdNumber =
      entityType === "INDIVIDUAL"
        ? normalizeIdValue(asStringOrNull(person.nic_brno) ?? "") ?? ""
        : "";
    if (!matchKey) return;
    individuals.push({
      matchKey,
      governmentIdNumber,
      name: asStringOrNull(name),
      email: asStringOrNull(email),
      type,
      entityType,
      sharePercentage,
    });
  };

  const directors = asArray(ctos.directors);
  for (const d of directors) {
    if (!isObject(d)) continue;
    const posRaw = asStringOrNull((d as UnknownRecord).position);
    const { isDirector, isShareholder } = ctosPositionDirectorShareholderFlags(posRaw);
    const pct = parseCtosEquityPercentage((d as UnknownRecord).equity_percentage);
    const displayName = d.name ?? d.fullName ?? d.businessName ?? d.companyName;
    const displayEmail = d.email ?? d.emailAddress;

    if (isDirector) {
      pushIndividual(d, displayName, displayEmail, "DIRECTOR", null);
    }
    if (isShareholder && pct !== null && pct >= 5) {
      pushIndividual(d, displayName, displayEmail, "SHAREHOLDER", pct);
    }
  }

  const shareholders = asArray(ctos.shareholders);
  for (const s of shareholders) {
    if (!isObject(s)) continue;
    const shareholderKey = getCtosId(s);
    if (!shareholderKey) continue;
    const pct = parseCtosEquityPercentage(s.equity_percentage);
    if (pct === null || pct < 5) continue;
    pushIndividual(
      s,
      s.name ?? s.fullName ?? s.businessName ?? s.companyName,
      s.email ?? s.emailAddress,
      "SHAREHOLDER",
      pct
    );
  }

  return individuals;
}

function buildKycMap(container: unknown): Map<string, UnknownRecord> {
  const result = new Map<string, UnknownRecord>();
  if (!isObject(container)) return result;
  const directors = asArray(container.directors);
  for (const d of directors) {
    if (!isObject(d)) continue;
    const key = normalizeId(asStringOrNull(d.governmentIdNumber));
    if (!key) continue;
    result.set(key, d);
  }
  return result;
}

function buildAmlMap(container: unknown): Map<string, UnknownRecord> {
  const result = new Map<string, UnknownRecord>();
  if (!isObject(container)) return result;
  const directors = asArray(container.directors);
  for (const d of directors) {
    if (!isObject(d)) continue;
    const key = normalizeId(asStringOrNull(d.governmentIdNumber));
    if (!key) continue;
    result.set(key, d);
  }
  return result;
}

/**
 * Usage:
 * const result = detectDirectorGaps({ ctos, issuer, supplement });
 */
export function detectDirectorGaps({ ctos, issuer, supplement }: GapInput): DetectDirectorGapsResult {
  const issuerObj = isObject(issuer) ? issuer : null;
  const supplementObj = isObject(supplement) ? supplement : null;

  const issuerKyc = issuerObj?.director_kyc_status ?? null;
  const issuerAml = issuerObj?.director_aml_status ?? null;

  const supplementOnboardingJson = isObject(supplementObj?.onboarding_json)
    ? (supplementObj?.onboarding_json as UnknownRecord)
    : null;
  const screening = isObject(supplementOnboardingJson?.screening)
    ? (supplementOnboardingJson.screening as UnknownRecord)
    : null;
  const nestedKyc = screening && isObject((screening as { kyc?: unknown }).kyc)
    ? ((screening as { kyc: UnknownRecord }).kyc as UnknownRecord)
    : null;
  const nestedNorm = isObject(nestedKyc?.normalized) ? (nestedKyc.normalized as UnknownRecord) : null;
  const legacyKyc = isObject(supplementOnboardingJson?.kyc)
    ? (supplementOnboardingJson.kyc as UnknownRecord)
    : null;
  const legacyNorm = isObject(legacyKyc?.normalized) ? (legacyKyc.normalized as UnknownRecord) : null;
  const supplementKyc = nestedNorm ?? legacyNorm;

  const ctosIndividuals = extractCtosIndividuals(ctos);
  const issuerMap = buildKycMap(issuerKyc);
  const supplementMap = buildKycMap(supplementKyc);
  const issuerAmlMap = buildAmlMap(issuerAml);

  const newRequired: NewRequiredIssue[] = [];
  const inProgress: InProgressIssue[] = [];
  const kycIssues: KycIssue[] = [];
  const amlIssues: AmlIssue[] = [];

  const gapProcessedMatchKeys = new Set<string>();

  for (const individual of ctosIndividuals) {
    const { matchKey, governmentIdNumber, name, email, type } = individual;
    if (individual.entityType !== "INDIVIDUAL") continue;
    if (!matchKey) continue;
    if (gapProcessedMatchKeys.has(matchKey)) continue;
    gapProcessedMatchKeys.add(matchKey);

    const issuerEntry = issuerMap.get(matchKey);
    const supplementEntry = supplementMap.get(matchKey);

    if (!issuerEntry && !supplementEntry) {
      newRequired.push({
        type: "NEW_REQUIRED",
        matchKey,
        governmentIdNumber,
        name,
        email,
        role: type,
      });
      continue;
    }

    if (!issuerEntry && supplementEntry) {
      const supplementKycStatus = asStringOrNull(supplementEntry.kycStatus);
      inProgress.push({
        type: "IN_PROGRESS",
        matchKey,
        governmentIdNumber,
        name,
        status: supplementKycStatus,
      });
      continue;
    }

    if (!issuerEntry) continue;

    const issuerStatus = asStringOrNull(issuerEntry.kycStatus);
    if (issuerStatus !== "APPROVED") {
      kycIssues.push({
        type: "KYC_INCOMPLETE",
        matchKey,
        governmentIdNumber,
        issuerStatus,
      });
      continue;
    }

    const issuerAmlEntry = issuerAmlMap.get(matchKey);
    const amlStatus = asStringOrNull(issuerAmlEntry?.amlStatus);
    const isApproved = typeof amlStatus === "string" && amlStatus.toUpperCase() === "APPROVED";
    if (!isApproved) {
      amlIssues.push({
        type: "AML_INCOMPLETE",
        matchKey,
        governmentIdNumber,
        amlStatus,
      });
    }
  }

  return {
    newRequired,
    inProgress,
    kycIssues,
    amlIssues,
  };
}
