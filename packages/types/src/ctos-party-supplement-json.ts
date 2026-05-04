/**
 * SECTION: CTOS party supplement `onboarding_json` (canonical)
 * WHY: Single flat shape: RegTank onboarding fields at root + optional `screening` snapshot from KYC/KYB webhooks.
 * INPUT: Prisma Json for `ctos_party_supplements.onboarding_json`
 * OUTPUT: Typed parse / merge / serialize for API + UI
 * WHERE USED: RegTank webhooks, organization service, build-people-list, issuer UI helpers
 */

import { normalizeRawStatus } from "./status-normalization";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type CleanScreening = {
  requestId: string;
  status: string;
  riskLevel?: string | null;
  riskScore?: string | number | null;
  provider?: string;
  updatedAt?: string;
  messageStatus?: string | number | boolean | null;
  possibleMatchCount?: number;
  blacklistedMatchCount?: number;
  referenceId?: string;
};

export type CtosPartySupplement = {
  requestId: string;
  /** RegTank individual onboarding pipeline status (raw, normalized on write). */
  status: string;
  email?: string;
  verifyLink?: string;
  /** RegTank `referenceId` for webhook + Prisma JSON path lookup. */
  referenceId?: string;
  sentAt?: string;
  lastSentAt?: string;
  sendTimestamps?: string[];
  updatedAt?: string;
  screening: CleanScreening | null;
  directorMismatchAdminRemark?: string;
  kybDirectorLinked?: boolean;
  kybShareholderLinked?: boolean;
};

function emptySupplement(): CtosPartySupplement {
  return {
    requestId: "",
    status: "",
    screening: null,
    updatedAt: new Date().toISOString(),
  };
}

function parseMessageStatus(v: unknown): string | number | boolean | null | undefined {
  if (v == null) return undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return undefined;
}

function parseRiskScore(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isNaN(n) && String(n) === t) return n;
    return t;
  }
  return null;
}

function parseScreening(raw: unknown): CleanScreening | null {
  if (!isObject(raw)) return null;
  const requestId = String(raw.requestId ?? "").trim();
  const statusRaw = String(raw.status ?? "").trim();
  if (!requestId && !statusRaw) return null;
  const status = normalizeRawStatus(statusRaw) || statusRaw;
  return {
    requestId,
    status,
    riskLevel: raw.riskLevel != null ? String(raw.riskLevel).trim() || null : null,
    riskScore: parseRiskScore(raw.riskScore),
    provider: typeof raw.provider === "string" ? raw.provider.trim() || undefined : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt.trim() || undefined : undefined,
    messageStatus: parseMessageStatus(raw.messageStatus),
    possibleMatchCount: typeof raw.possibleMatchCount === "number" ? raw.possibleMatchCount : undefined,
    blacklistedMatchCount: typeof raw.blacklistedMatchCount === "number" ? raw.blacklistedMatchCount : undefined,
    referenceId: typeof raw.referenceId === "string" ? raw.referenceId.trim() || undefined : undefined,
  };
}

/** Parse DB JSON into the canonical supplement shape (unknown keys ignored). */
export function parseCtosPartySupplement(raw: unknown): CtosPartySupplement {
  if (!isObject(raw)) return emptySupplement();
  const screening = parseScreening(raw.screening);
  const requestIdTop = String(raw.requestId ?? "").trim();
  const statusTop = String(raw.status ?? "").trim();
  const sendTimestamps = Array.isArray(raw.sendTimestamps)
    ? raw.sendTimestamps.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    : undefined;
  const requestId = requestIdTop || (screening?.requestId ?? "");
  const status = normalizeRawStatus(statusTop) || statusTop;
  return {
    requestId,
    status,
    email: typeof raw.email === "string" ? raw.email.trim() || undefined : undefined,
    verifyLink: typeof raw.verifyLink === "string" ? raw.verifyLink.trim() || undefined : undefined,
    referenceId: typeof raw.referenceId === "string" ? raw.referenceId.trim() || undefined : undefined,
    sentAt: typeof raw.sentAt === "string" ? raw.sentAt.trim() || undefined : undefined,
    lastSentAt: typeof raw.lastSentAt === "string" ? raw.lastSentAt.trim() || undefined : undefined,
    sendTimestamps,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt.trim() || undefined : undefined,
    screening,
    directorMismatchAdminRemark:
      typeof raw.directorMismatchAdminRemark === "string" ? raw.directorMismatchAdminRemark.trim() || undefined : undefined,
    kybDirectorLinked: raw.kybDirectorLinked === true ? true : undefined,
    kybShareholderLinked: raw.kybShareholderLinked === true ? true : undefined,
  };
}

export type CtosPartySupplementMergePatch = {
  regtankPipelineStatus?: string;
  onboarding?: Record<string, unknown> | null;
  screening?: Record<string, unknown> | null;
  screeningReset?: boolean;
};

function toCleanScreening(patch: Record<string, unknown>): CleanScreening | null {
  const requestId = String(patch.requestId ?? "").trim();
  const statusRaw = String(patch.status ?? "").trim();
  if (!requestId || !statusRaw) return null;
  return {
    requestId,
    status: normalizeRawStatus(statusRaw) || statusRaw,
    riskLevel: patch.riskLevel != null ? String(patch.riskLevel).trim() || null : null,
    riskScore: parseRiskScore(patch.riskScore),
    provider: typeof patch.provider === "string" ? patch.provider.trim() || undefined : undefined,
    updatedAt: typeof patch.updatedAt === "string" ? patch.updatedAt.trim() || undefined : undefined,
    messageStatus: parseMessageStatus(patch.messageStatus),
    possibleMatchCount: typeof patch.possibleMatchCount === "number" ? patch.possibleMatchCount : undefined,
    blacklistedMatchCount: typeof patch.blacklistedMatchCount === "number" ? patch.blacklistedMatchCount : undefined,
    referenceId: typeof patch.referenceId === "string" ? patch.referenceId.trim() || undefined : undefined,
  };
}

function mergeOnboardingFields(
  base: CtosPartySupplement,
  patch: Record<string, unknown> | null | undefined
): void {
  if (!patch || !isObject(patch)) return;
  const str = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t || undefined;
  };
  const e = str(patch.email);
  if (e !== undefined) base.email = e;
  if (patch.verifyLink === "" || patch.verifyLink === null) {
    base.verifyLink = undefined;
  } else {
    const vl = str(patch.verifyLink);
    if (vl !== undefined) base.verifyLink = vl;
  }
  const ref = str(patch.referenceId);
  if (ref !== undefined) base.referenceId = ref;
  const sa = str(patch.sentAt);
  if (sa !== undefined) base.sentAt = sa;
  const lsa = str(patch.lastSentAt);
  if (lsa !== undefined) base.lastSentAt = lsa;
  if (typeof patch.requestId === "string" && patch.requestId.trim()) {
    base.requestId = patch.requestId.trim();
  }
  if (typeof patch.status === "string" && patch.status.trim()) {
    base.status = normalizeRawStatus(patch.status) || patch.status.trim();
  }
  if (Array.isArray(patch.sendTimestamps)) {
    base.sendTimestamps = patch.sendTimestamps
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof patch.directorMismatchAdminRemark === "string") {
    const t = patch.directorMismatchAdminRemark.trim();
    base.directorMismatchAdminRemark = t || undefined;
  }
  if (patch.kybDirectorLinked === true) base.kybDirectorLinked = true;
  if (patch.kybShareholderLinked === true) base.kybShareholderLinked = true;
}

/**
 * Merge patch into previous supplement JSON. Returns a plain object suitable for Prisma `InputJsonValue`.
 */
export function mergeCtosPartySupplementDocument(
  prevRaw: unknown,
  patch: CtosPartySupplementMergePatch
): Record<string, unknown> {
  const base = parseCtosPartySupplement(prevRaw);
  if (patch.regtankPipelineStatus !== undefined) {
    base.status = normalizeRawStatus(patch.regtankPipelineStatus) || String(patch.regtankPipelineStatus).trim();
  }
  mergeOnboardingFields(base, patch.onboarding ?? undefined);

  if (patch.screeningReset) {
    base.screening = null;
  } else if (patch.screening === null) {
    base.screening = null;
  } else if (patch.screening && isObject(patch.screening)) {
    const next = toCleanScreening(patch.screening);
    base.screening = next;
  }

  if (!base.requestId.trim() && base.screening?.requestId) {
    base.requestId = base.screening.requestId.trim();
  }

  base.updatedAt = new Date().toISOString();
  return serializeCtosPartySupplement(base) as Record<string, unknown>;
}

/** JSON-serializable document for persistence (drops undefined). */
export function serializeCtosPartySupplement(doc: CtosPartySupplement): Record<string, unknown> {
  const o: Record<string, unknown> = {
    requestId: doc.requestId,
    status: doc.status,
    screening: doc.screening,
    updatedAt: doc.updatedAt ?? new Date().toISOString(),
  };
  if (doc.email !== undefined) o.email = doc.email;
  if (doc.verifyLink !== undefined) o.verifyLink = doc.verifyLink;
  if (doc.referenceId !== undefined) o.referenceId = doc.referenceId;
  if (doc.sentAt !== undefined) o.sentAt = doc.sentAt;
  if (doc.lastSentAt !== undefined) o.lastSentAt = doc.lastSentAt;
  if (doc.sendTimestamps !== undefined && doc.sendTimestamps.length > 0) o.sendTimestamps = doc.sendTimestamps;
  if (doc.directorMismatchAdminRemark !== undefined) o.directorMismatchAdminRemark = doc.directorMismatchAdminRemark;
  if (doc.kybDirectorLinked === true) o.kybDirectorLinked = true;
  if (doc.kybShareholderLinked === true) o.kybShareholderLinked = true;
  return o;
}

export function getCtosPartySupplementPipelineStatus(root: unknown): string {
  return parseCtosPartySupplement(root).status;
}

export function getCtosPartySupplementRequestId(root: unknown): string {
  return parseCtosPartySupplement(root).requestId;
}

export function isCtosPartySupplementApprovalLocked(root: unknown): boolean {
  const s = parseCtosPartySupplement(root);
  const onb = normalizeRawStatus(s.status);
  const aml = s.screening ? normalizeRawStatus(s.screening.status) : "";
  return onb === "APPROVED" || aml === "APPROVED";
}

/** @deprecated Prefer reading {@link CtosPartySupplement} fields directly. */
export function getCtosPartySupplementFlatRead(root: unknown): {
  email: string;
  requestId: string;
  verifyLink: string;
  regtankStatus: string | null;
  kycBlock: Record<string, unknown> | null;
  amlBlock: Record<string, unknown> | null;
} {
  const s = parseCtosPartySupplement(root);
  const scr = s.screening;
  const synthetic =
    scr && (scr.status || scr.requestId)
      ? { rawStatus: scr.status }
      : null;
  return {
    email: s.email ?? "",
    requestId: s.requestId,
    verifyLink: s.verifyLink ?? "",
    regtankStatus: s.status || null,
    kycBlock: synthetic,
    amlBlock: synthetic,
  };
}

/**
 * Normalize persisted JSON before Prisma write (drops unknown screening keys).
 * @deprecated Use {@link serializeCtosPartySupplement} after {@link parseCtosPartySupplement}.
 */
export function sanitizeCtosPartySupplementOnboardingJsonForPersist(raw: unknown): Record<string, unknown> {
  return serializeCtosPartySupplement(parseCtosPartySupplement(raw));
}
