type GuarantorType = "individual" | "company";

export type GuarantorAmlStatus = "Unresolved" | "Approved" | "Rejected" | "Pending";
export type GuarantorAmlMessageStatus = "DONE" | "PENDING" | "ERROR";

export interface ParsedApplicationGuarantor {
  guarantorId: string;
  guarantorType: GuarantorType;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  icNumber?: string;
  ssmNumber?: string;
}

export interface GuarantorAmlRecord {
  orgGuarantorKey: string;
  guarantorType: GuarantorType;
  guarantorId: string;
  applicationId: string;
  linkedApplicationIds: string[];
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  icNumber?: string;
  ssmNumber?: string;
  requestId?: string;
  kycId?: string;
  kybId?: string;
  regtankPortalUrl?: string;
  onboardingStatus?: string;
  onboardingSubstatus?: string;
  amlStatus: GuarantorAmlStatus;
  amlMessageStatus: GuarantorAmlMessageStatus;
  amlRiskScore: number | null;
  amlRiskLevel: string | null;
  triggeredAt: string;
  lastSyncedAt: string;
  lastUpdated: string;
  triggeredByAdminUserId?: string;
}

export interface GuarantorAmlStore {
  version: 1;
  guarantors: GuarantorAmlRecord[];
  updatedAt: string;
}

function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value: unknown): string {
  return normalizeText(value).replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function toSafeToken(value: string): string {
  const compact = value.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  return compact.length > 0 ? compact : "unknown";
}

export function getDeterministicGuarantorId(
  index: number,
  guarantorType: GuarantorType,
  icNumber?: string,
  ssmNumber?: string
): string {
  const tokenBase =
    guarantorType === "individual"
      ? normalizeIdentifier(icNumber ?? "")
      : normalizeIdentifier(ssmNumber ?? "");
  const token = tokenBase.length > 0 ? tokenBase : `idx${index + 1}`;
  return `g-${guarantorType}-${toSafeToken(token)}`;
}

export function buildOrganizationGuarantorKey(guarantor: {
  guarantorType: GuarantorType;
  icNumber?: string;
  ssmNumber?: string;
  email: string;
}): string {
  if (guarantor.guarantorType === "individual") {
    const ic = normalizeIdentifier(guarantor.icNumber ?? "");
    if (ic.length > 0) return `individual:${ic}`;
    return `individual:email:${normalizeEmail(guarantor.email)}`;
  }
  const ssm = normalizeIdentifier(guarantor.ssmNumber ?? "");
  if (ssm.length > 0) return `company:${ssm}`;
  return `company:email:${normalizeEmail(guarantor.email)}`;
}

export function parseApplicationGuarantors(businessDetails: unknown): ParsedApplicationGuarantor[] {
  const row = toRecord(businessDetails);
  const rawGuarantors = row.guarantors;
  if (!Array.isArray(rawGuarantors)) return [];

  const parsed: ParsedApplicationGuarantor[] = [];
  for (let index = 0; index < rawGuarantors.length; index += 1) {
    const raw = toRecord(rawGuarantors[index]);
    const guarantorType = raw.guarantor_type === "company" ? "company" : "individual";
    const email = normalizeEmail(raw.email);
    if (!email) continue;

    if (guarantorType === "individual") {
      const icNumber = normalizeIdentifier(raw.ic_number ?? raw.icNumber);
      const firstName = normalizeText(raw.first_name ?? raw.firstName);
      const lastName = normalizeText(raw.last_name ?? raw.lastName);
      const explicitId = normalizeText(raw.guarantor_id ?? raw.guarantorId);
      parsed.push({
        guarantorId:
          explicitId ||
          getDeterministicGuarantorId(index, guarantorType, icNumber, undefined),
        guarantorType,
        email,
        firstName,
        lastName,
        icNumber,
      });
      continue;
    }

    const ssmNumber = normalizeIdentifier(raw.ssm_number ?? raw.ssmNumber);
    const companyName = normalizeText(raw.company_name ?? raw.companyName);
    const explicitId = normalizeText(raw.guarantor_id ?? raw.guarantorId);
    parsed.push({
      guarantorId:
        explicitId ||
        getDeterministicGuarantorId(index, guarantorType, undefined, ssmNumber),
      guarantorType,
      email,
      companyName,
      ssmNumber,
    });
  }

  return parsed;
}

export function readGuarantorAmlStore(raw: unknown): GuarantorAmlStore {
  const obj = toRecord(raw);
  const rawGuarantors = Array.isArray(obj.guarantors) ? obj.guarantors : [];
  const guarantors: GuarantorAmlRecord[] = [];
  for (const item of rawGuarantors) {
    const record = toRecord(item);
    if (typeof record.orgGuarantorKey !== "string") continue;
    guarantors.push({
      orgGuarantorKey: record.orgGuarantorKey,
      guarantorType: record.guarantorType === "company" ? "company" : "individual",
      guarantorId: normalizeText(record.guarantorId),
      applicationId: normalizeText(record.applicationId),
      linkedApplicationIds: Array.isArray(record.linkedApplicationIds)
        ? record.linkedApplicationIds.filter((id): id is string => typeof id === "string")
        : [],
      email: normalizeEmail(record.email),
      firstName: normalizeText(record.firstName) || undefined,
      lastName: normalizeText(record.lastName) || undefined,
      companyName: normalizeText(record.companyName) || undefined,
      icNumber: normalizeIdentifier(record.icNumber) || undefined,
      ssmNumber: normalizeIdentifier(record.ssmNumber) || undefined,
      requestId: normalizeText(record.requestId) || undefined,
      kycId: normalizeText(record.kycId) || undefined,
      kybId: normalizeText(record.kybId) || undefined,
      regtankPortalUrl: normalizeText(record.regtankPortalUrl) || undefined,
      onboardingStatus: normalizeText(record.onboardingStatus) || undefined,
      onboardingSubstatus: normalizeText(record.onboardingSubstatus) || undefined,
      amlStatus: mapScreeningStatusToAml(
        typeof record.amlStatus === "string" ? record.amlStatus : undefined
      ),
      amlMessageStatus:
        record.amlMessageStatus === "DONE" ||
        record.amlMessageStatus === "ERROR"
          ? record.amlMessageStatus
          : "PENDING",
      amlRiskScore: typeof record.amlRiskScore === "number" ? record.amlRiskScore : null,
      amlRiskLevel: normalizeText(record.amlRiskLevel) || null,
      triggeredAt: normalizeText(record.triggeredAt) || new Date().toISOString(),
      lastSyncedAt: normalizeText(record.lastSyncedAt) || new Date().toISOString(),
      lastUpdated: normalizeText(record.lastUpdated) || new Date().toISOString(),
      triggeredByAdminUserId: normalizeText(record.triggeredByAdminUserId) || undefined,
    });
  }

  return {
    version: 1,
    guarantors,
    updatedAt: normalizeText(obj.updatedAt) || new Date().toISOString(),
  };
}

export function writeGuarantorAmlStore(
  previousRaw: unknown,
  store: GuarantorAmlStore
): Record<string, unknown> {
  const previous = toRecord(previousRaw);
  return {
    ...previous,
    version: 1,
    guarantors: store.guarantors,
    updatedAt: store.updatedAt,
  };
}

export function upsertGuarantorAmlRecord(
  store: GuarantorAmlStore,
  next: GuarantorAmlRecord
): GuarantorAmlStore {
  const idx = store.guarantors.findIndex((g) => g.orgGuarantorKey === next.orgGuarantorKey);
  if (idx === -1) {
    return {
      ...store,
      updatedAt: next.lastUpdated,
      guarantors: [...store.guarantors, next],
    };
  }
  const merged = [...store.guarantors];
  merged[idx] = next;
  return {
    ...store,
    updatedAt: next.lastUpdated,
    guarantors: merged,
  };
}

export function buildRegTankPortalUrl(adminPortalBaseUrl: string, requestId: string): string {
  if (requestId.startsWith("COD")) {
    return `${adminPortalBaseUrl}/app/onboardingCorporate/${requestId}?archived=false`;
  }
  return `${adminPortalBaseUrl}/app/liveness/${requestId}?archived=false`;
}

export function mapScreeningStatusToAml(status: string | undefined): GuarantorAmlStatus {
  if (!status) return "Pending";
  const upper = status.toUpperCase();
  if (upper === "APPROVED" || upper === "RISK ASSESSED") return "Approved";
  if (upper === "REJECTED") return "Rejected";
  if (upper === "UNRESOLVED" || upper === "NO_MATCH") return "Unresolved";
  return "Pending";
}

export function extractKycId(raw: unknown): string | undefined {
  const obj = toRecord(raw);
  const direct = normalizeText(obj.kycId ?? obj.requestId);
  if (direct) return direct;
  const info = toRecord(obj.kycRequestInfo);
  const nested = normalizeText(info.kycId ?? info.requestId);
  return nested || undefined;
}

export function extractKybId(raw: unknown): string | undefined {
  const obj = toRecord(raw);
  const direct = normalizeText(obj.kybId);
  if (direct) return direct;
  const dto = toRecord(obj.kybRequestDto);
  const nested = normalizeText(dto.kybId ?? dto.requestId);
  return nested || undefined;
}
