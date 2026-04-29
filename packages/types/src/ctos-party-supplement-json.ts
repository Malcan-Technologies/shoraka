/**
 * SECTION: CTOS party supplement `onboarding_json` shape
 * WHY: `onboarding` = RegTank link flow; `screening` = single ACURIS blob (+ optional `normalized`)
 * INPUT: Raw Prisma Json for `ctos_party_supplements.onboarding_json`
 * OUTPUT: Effective onboarding + flat screening + merged persist document
 * WHERE USED: API webhooks, organization service, issuer/investor UI, types helpers
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCtosPartySupplementRoot(raw: unknown): Record<string, unknown> {
  if (isObject(raw)) return { ...raw };
  return {};
}

const RESERVED_TOP_KEYS = new Set([
  "onboarding",
  "screening",
  "email",
  "requestId",
  "verifyLink",
  "referenceId",
  "sent",
  "sentAt",
  "lastSentAt",
  "sendTimestamps",
  "regtankStatus",
  "status",
  "kyc",
  "aml",
  "updatedAt",
]);

/**
 * Effective onboarding block: nested `onboarding` or legacy flat keys.
 * `status` is the RegTank pipeline value (legacy `regtankStatus`).
 */
export function getEffectiveCtosPartyOnboarding(root: Record<string, unknown>): Record<string, unknown> {
  const nested = root.onboarding;
  if (isObject(nested)) {
    const o = { ...nested };
    if (o.status == null && o.regtankStatus != null) {
      o.status = o.regtankStatus;
    }
    return o;
  }
  const rawSt = root.regtankStatus ?? root.status;
  let statusOut: string | undefined;
  if (typeof rawSt === "string") statusOut = rawSt;
  else if (rawSt != null && rawSt !== undefined) statusOut = String(rawSt);
  return {
    email: root.email,
    requestId: root.requestId,
    verifyLink: root.verifyLink,
    referenceId: root.referenceId,
    sent: root.sent,
    sentAt: root.sentAt,
    lastSentAt: root.lastSentAt,
    sendTimestamps: root.sendTimestamps,
    status: statusOut,
    updatedAt: root.updatedAt,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return isObject(value) ? (value as Record<string, unknown>) : null;
}

/** Legacy top-level `kyc` + `aml` → one flat screening (aml wins on duplicate keys). */
function flatScreeningFromLegacyKycAml(
  kyc: Record<string, unknown>,
  aml: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...kyc, ...aml };
  const provider = String(merged.provider ?? "ACURIS").trim() || "ACURIS";
  const requestId = String(merged.requestId ?? "").trim();
  const amlRaw = typeof aml.rawStatus === "string" ? aml.rawStatus.trim() : "";
  const kycRaw = typeof kyc.rawStatus === "string" ? kyc.rawStatus.trim() : "";
  const status = amlRaw || kycRaw || String(merged.status ?? "").trim();
  const nk = asObject(kyc.normalized);
  const na = asObject(aml.normalized);
  let normalized: Record<string, unknown> | undefined;
  if (nk && na) normalized = { ...nk, ...na };
  else if (na) normalized = { ...na };
  else if (nk) normalized = { ...nk };
  const out: Record<string, unknown> = {
    provider,
    requestId,
    status,
    riskLevel: String(merged.riskLevel ?? ""),
    riskScore: String(merged.riskScore ?? ""),
    updatedAt: String(merged.updatedAt ?? ""),
  };
  if (merged.messageStatus !== undefined && merged.messageStatus !== null) {
    out.messageStatus = merged.messageStatus;
  }
  if (typeof merged.referenceId === "string" && merged.referenceId.trim()) {
    out.referenceId = merged.referenceId.trim();
  }
  if (typeof aml.possibleMatchCount === "number") out.possibleMatchCount = aml.possibleMatchCount;
  if (typeof aml.blacklistedMatchCount === "number") out.blacklistedMatchCount = aml.blacklistedMatchCount;
  if (normalized) out.normalized = normalized;
  return out;
}

/**
 * Single flat ACURIS screening (+ optional `normalized` for issuer-shaped sync).
 * Legacy: merges top-level `aml` over `kyc`, or nested `screening.kyc` / `screening.aml`.
 */
export function getEffectiveCtosPartyScreening(root: Record<string, unknown>): Record<string, unknown> {
  const nested = root.screening;
  if (isObject(nested)) {
    const kycChild = asObject(nested.kyc);
    const amlChild = asObject(nested.aml);
    if (kycChild || amlChild) {
      const flatFromChildren = flatScreeningFromLegacyKycAml(kycChild ?? {}, amlChild ?? {});
      const { kyc: _k, aml: _a, ...rest } = nested as Record<string, unknown>;
      return { ...flatFromChildren, ...rest };
    }
    return { ...nested };
  }
  const kyc = asObject(root.kyc) ?? {};
  const aml = asObject(root.aml) ?? {};
  if (Object.keys(kyc).length === 0 && Object.keys(aml).length === 0) return {};
  return flatScreeningFromLegacyKycAml(kyc, aml);
}

/** True when RegTank KYC is already approved (email must not change). */
export function isCtosPartySupplementApprovalLocked(root: unknown): boolean {
  const r = parseCtosPartySupplementRoot(root);
  const onb = getEffectiveCtosPartyOnboarding(r);
  const scr = getEffectiveCtosPartyScreening(r);
  const regtankStatus = String(onb.status ?? onb.regtankStatus ?? "").trim().toUpperCase();
  const screeningRaw = String(scr.status ?? "").trim().toUpperCase();
  return regtankStatus === "APPROVED" || screeningRaw === "APPROVED";
}

export type CtosPartySupplementMergePatch = {
  onboarding?: Record<string, unknown>;
  /** Flat ACURIS fields (+ optional `normalized`). Shallow-merged over previous screening. */
  screening?: Record<string, unknown> | null;
  /** When true, `screening` replaces screening entirely (no merge with prior). */
  screeningReset?: boolean;
  /** Sets `onboarding.status` (RegTank pipeline; replaces legacy `regtankStatus`). */
  regtankPipelineStatus?: string;
};

/**
 * Build persisted JSON: `onboarding` + `screening` + non-reserved extras (KYB flags, etc.).
 * Strips legacy duplicate keys from the merged output.
 */
export function mergeCtosPartySupplementDocument(
  prevRaw: unknown,
  patch: CtosPartySupplementMergePatch
): Record<string, unknown> {
  const prev = parseCtosPartySupplementRoot(prevRaw);
  const effOnb = getEffectiveCtosPartyOnboarding(prev);
  const effScr = getEffectiveCtosPartyScreening(prev);

  const onboarding: Record<string, unknown> = { ...effOnb, ...(patch.onboarding ?? {}) };
  if (patch.regtankPipelineStatus !== undefined) {
    onboarding.status = patch.regtankPipelineStatus;
  }
  delete onboarding.regtankStatus;

  let screening: Record<string, unknown>;
  if (patch.screeningReset && patch.screening && isObject(patch.screening)) {
    screening = { ...patch.screening };
  } else {
    screening = {
      ...effScr,
      ...(patch.screening ?? {}),
    };
  }
  delete screening.kyc;
  delete screening.aml;

  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (RESERVED_TOP_KEYS.has(k)) continue;
    extras[k] = v;
  }

  return {
    ...extras,
    onboarding,
    screening,
  };
}

/** RegTank / display pipeline status (legacy `regtankStatus` or nested `onboarding.status`). */
export function getCtosPartySupplementPipelineStatus(root: unknown): string {
  const r = parseCtosPartySupplementRoot(root);
  const onb = getEffectiveCtosPartyOnboarding(r);
  return String(onb.status ?? onb.regtankStatus ?? "").trim();
}

export function getCtosPartySupplementRequestId(root: unknown): string {
  const r = parseCtosPartySupplementRoot(root);
  const onb = getEffectiveCtosPartyOnboarding(r);
  return String(onb.requestId ?? onb.eodRequestId ?? "").trim();
}

/** Flat read for UI rows that still expect kyc/aml-shaped blocks for display helpers. */
export function getCtosPartySupplementFlatRead(root: unknown): {
  email: string;
  requestId: string;
  verifyLink: string;
  regtankStatus: string | null;
  kycBlock: Record<string, unknown> | null;
  amlBlock: Record<string, unknown> | null;
} {
  const r = parseCtosPartySupplementRoot(root);
  const onb = getEffectiveCtosPartyOnboarding(r);
  const scr = getEffectiveCtosPartyScreening(r);
  const requestId = String(onb.requestId ?? "").trim();
  const verifyLink = String(onb.verifyLink ?? "").trim();
  const st = String(onb.status ?? onb.regtankStatus ?? "").trim();
  const screeningStatus = String(scr.status ?? "").trim();
  const hasScreeningPayload = Object.keys(scr).some(
    (k) => k !== "normalized" && scr[k] !== undefined && scr[k] !== null && String(scr[k]).trim() !== ""
  );
  const synthetic =
    screeningStatus || hasScreeningPayload ? { rawStatus: screeningStatus || undefined } : null;
  return {
    email: String(onb.email ?? "").trim(),
    requestId,
    verifyLink,
    regtankStatus: st || null,
    kycBlock: synthetic,
    amlBlock: synthetic,
  };
}
