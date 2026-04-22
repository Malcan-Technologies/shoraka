import { parseGuarantorsFromBusinessDetails } from "../guarantors/utils";

type GuarantorType = "individual" | "company";

export type GuarantorAmlStatus = "Unresolved" | "Approved" | "Rejected" | "Pending";
export type GuarantorAmlMessageStatus = "DONE" | "PENDING" | "ERROR";

export interface ParsedApplicationGuarantor {
  guarantorId: string;
  guarantorType: GuarantorType;
  email: string;
  name?: string;
  icNumber?: string;
  businessName?: string;
  ssmNumber?: string;
}

export interface GuarantorAmlRecord {
  orgGuarantorKey: string;
  guarantorType: GuarantorType;
  guarantorId: string;
  applicationId: string;
  linkedApplicationIds: string[];
  email: string;
  name?: string;
  icNumber?: string;
  businessName?: string;
  ssmNumber?: string;
  requestId?: string;
  onboardingVerifyLink?: string;
  kycId?: string;
  kybId?: string;
  regtankPortalUrl?: string;
  onboardingStatus?: string;
  onboardingSubstatus?: string;
  amlStatus: GuarantorAmlStatus;
  amlMessageStatus: GuarantorAmlMessageStatus;
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
    const gid = normalizeIdentifier(guarantor.icNumber ?? "");
    if (gid.length > 0) return `individual:${gid}`;
    return `individual:email:${normalizeEmail(guarantor.email)}`;
  }
  const bid = normalizeIdentifier(guarantor.ssmNumber ?? "");
  if (bid.length > 0) return `company:${bid}`;
  return `company:email:${normalizeEmail(guarantor.email)}`;
}

export function parseApplicationGuarantors(businessDetails: unknown): ParsedApplicationGuarantor[] {
  return parseGuarantorsFromBusinessDetails(businessDetails).map(
    ({
      guarantorId,
      guarantorType,
      email,
      name,
      icNumber,
      businessName,
      ssmNumber,
    }) => ({
      guarantorId,
      guarantorType,
      email,
      name,
      icNumber,
      businessName,
      ssmNumber,
    })
  );
}

export function readGuarantorAmlStore(raw: unknown): GuarantorAmlStore {
  const obj = toRecord(raw);
  const rawGuarantors = Array.isArray(obj.guarantors) ? obj.guarantors : [];
  const guarantors: GuarantorAmlRecord[] = [];
  for (const item of rawGuarantors) {
    const record = toRecord(item);
    if (typeof record.orgGuarantorKey !== "string") continue;
    const legacyFirst = normalizeText(record["firstName"]);
    const legacyLast = normalizeText(record["lastName"]);
    const legacyName =
      normalizeText(record["name"]) ||
      [legacyFirst, legacyLast].filter(Boolean).join(" ").trim() ||
      undefined;
    const legacyIc =
      normalizeIdentifier(record["icNumber"]) ||
      normalizeIdentifier(record["governmentIdNumber"]) ||
      undefined;
    const legacyBizName =
      normalizeText(record["businessName"] ?? record["companyName"]) || undefined;
    const legacySsm =
      normalizeText(record["ssmNumber"]) || normalizeText(record["businessIdNumber"]) || undefined;

    guarantors.push({
      orgGuarantorKey: record.orgGuarantorKey,
      guarantorType: record.guarantorType === "company" ? "company" : "individual",
      guarantorId: normalizeText(record.guarantorId),
      applicationId: normalizeText(record.applicationId),
      linkedApplicationIds: Array.isArray(record.linkedApplicationIds)
        ? record.linkedApplicationIds.filter((id): id is string => typeof id === "string")
        : [],
      email: normalizeEmail(record.email),
      name: legacyName,
      icNumber: legacyIc,
      businessName: legacyBizName,
      ssmNumber: legacySsm,
      requestId: normalizeText(record.requestId) || undefined,
      onboardingVerifyLink: normalizeText(record.onboardingVerifyLink) || undefined,
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

/** RegTank KYC/KYB screening status values (Acuris or Dow Jones; e.g. "No Match", "Approved") → DB enum */
export function mapRegTankDjkycStatusToPrismaAmlStatus(status: string | undefined): GuarantorAmlStatus {
  if (!status) return "Pending";
  const compact = status.toUpperCase().replace(/\s+/g, "_");
  if (compact === "APPROVED") return "Approved";
  if (compact === "REJECTED") return "Rejected";
  if (compact === "TERMINATED") return "Rejected";
  if (
    compact === "UNRESOLVED" ||
    compact === "NO_MATCH" ||
    compact === "POSITIVE_MATCH"
  ) {
    return "Unresolved";
  }
  return "Pending";
}

export function mapRegTankDjkycMessageToPrisma(
  messageStatus: string | undefined
): GuarantorAmlMessageStatus {
  const u = (messageStatus ?? "").toUpperCase();
  if (u === "DONE") return "DONE";
  if (u === "ERROR") return "ERROR";
  return "PENDING";
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
