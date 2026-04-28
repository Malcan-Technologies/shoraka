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

type CtosIndividual = {
  matchKey: string;
  governmentIdNumber: string;
  name: string | null;
  email: string | null;
  type: CtosIndividualType;
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

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeId(id?: string | null): string | null {
  if (!id || typeof id !== "string") return null;
  const normalized = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function getCtosPersonId(x: unknown): string | null {
  if (!isObject(x)) return null;
  const raw = x.nic_brno || x.ic_lcno || null;
  if (!raw || typeof raw !== "string") return null;
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function extractCtosIndividuals(ctos: unknown): CtosIndividual[] {
  if (!isObject(ctos)) return [];

  const individuals: CtosIndividual[] = [];
  const seen = new Set<string>();

  const addIndividual = (
    person: UnknownRecord,
    name: unknown,
    email: unknown,
    type: CtosIndividualType
  ): void => {
    const matchKey = getCtosPersonId(person);
    const governmentIdNumber = asStringOrNull(person.nic_brno) ?? asStringOrNull(person.ic_lcno);
    if (!governmentIdNumber || !matchKey) return;
    if (seen.has(matchKey)) return;
    seen.add(matchKey);
    individuals.push({
      matchKey,
      governmentIdNumber,
      name: asStringOrNull(name),
      email: asStringOrNull(email),
      type,
    });
  };

  const directors = asArray(ctos.directors);
  for (const d of directors) {
    if (!isObject(d)) continue;
    addIndividual(
      d,
      d.name ?? d.fullName,
      d.email ?? d.emailAddress,
      "DIRECTOR"
    );
  }

  const shareholders = asArray(ctos.shareholders);
  for (const s of shareholders) {
    if (!isObject(s)) continue;
    const sharePercentage = asNumberOrNull(
      s.sharePercentage ?? s.share_percentage ?? s.percentage ?? s.sharesPercentage
    );
    if (sharePercentage === null || sharePercentage < 5) continue;
    addIndividual(
      s,
      s.name ?? s.fullName,
      s.email ?? s.emailAddress,
      "SHAREHOLDER"
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
  const supplementKyc = isObject(supplementOnboardingJson?.kyc)
    ? (supplementOnboardingJson?.kyc as UnknownRecord).normalized ?? null
    : null;

  const ctosIndividuals = extractCtosIndividuals(ctos);
  const issuerMap = buildKycMap(issuerKyc);
  const supplementMap = buildKycMap(supplementKyc);
  const issuerAmlMap = buildAmlMap(issuerAml);

  const newRequired: NewRequiredIssue[] = [];
  const inProgress: InProgressIssue[] = [];
  const kycIssues: KycIssue[] = [];
  const amlIssues: AmlIssue[] = [];

  for (const individual of ctosIndividuals) {
    const { matchKey, governmentIdNumber, name, email, type } = individual;
    if (!matchKey) continue;

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

