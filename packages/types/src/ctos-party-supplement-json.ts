/**
 * SECTION: CTOS party supplement `onboarding_json` shape
 * WHY: Split RegTank onboarding vs ACURIS screening; keep legacy reads working
 * INPUT: Raw Prisma Json for `ctos_party_supplements.onboarding_json`
 * OUTPUT: Effective onboarding/screening views + merged persist document
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

/** True when RegTank KYC is already approved (email must not change). */
export function isCtosPartySupplementApprovalLocked(root: unknown): boolean {
  const r = parseCtosPartySupplementRoot(root);
  const onb = getEffectiveCtosPartyOnboarding(r);
  const scr = getEffectiveCtosPartyScreening(r);
  const regtankStatus = String(onb.status ?? onb.regtankStatus ?? "").trim().toUpperCase();
  const kycRaw =
    scr.kyc && typeof scr.kyc === "object" && !Array.isArray(scr.kyc)
      ? String((scr.kyc as Record<string, unknown>).rawStatus ?? "").trim().toUpperCase()
      : "";
  return regtankStatus === "APPROVED" || kycRaw === "APPROVED";
}

function screeningProviderFromBlocks(
  kyc: Record<string, unknown>,
  aml: Record<string, unknown>
): string {
  const pk = kyc.provider;
  const pa = aml.provider;
  if (typeof pk === "string" && pk.trim()) return pk.trim();
  if (typeof pa === "string" && pa.trim()) return pa.trim();
  return "ACURIS";
}

/**
 * Effective screening: nested `screening` (kyc + aml ACURIS payloads) or legacy top-level `kyc` / `aml`.
 */
export function getEffectiveCtosPartyScreening(root: Record<string, unknown>): {
  provider: string;
  kyc: Record<string, unknown>;
  aml: Record<string, unknown>;
} {
  const nested = root.screening;
  if (isObject(nested)) {
    const kyc = isObject(nested.kyc) ? { ...(nested.kyc as Record<string, unknown>) } : {};
    const aml = isObject(nested.aml) ? { ...(nested.aml as Record<string, unknown>) } : {};
    const provider =
      typeof nested.provider === "string" && nested.provider.trim()
        ? nested.provider.trim()
        : screeningProviderFromBlocks(kyc, aml);
    return { provider, kyc, aml };
  }
  const kyc = isObject(root.kyc) ? { ...(root.kyc as Record<string, unknown>) } : {};
  const aml = isObject(root.aml) ? { ...(root.aml as Record<string, unknown>) } : {};
  return {
    provider: screeningProviderFromBlocks(kyc, aml),
    kyc,
    aml,
  };
}

export type CtosPartySupplementMergePatch = {
  onboarding?: Record<string, unknown>;
  screening?: { kyc?: Record<string, unknown>; aml?: Record<string, unknown> };
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

  const kyc = { ...effScr.kyc, ...(patch.screening?.kyc ?? {}) };
  const aml = { ...effScr.aml, ...(patch.screening?.aml ?? {}) };
  const screening = {
    provider: effScr.provider || screeningProviderFromBlocks(kyc, aml),
    kyc,
    aml,
  };

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

/** Flat read for UI rows that still expect one blob per party. */
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
  const kycKeys = Object.keys(scr.kyc);
  const amlKeys = Object.keys(scr.aml);
  return {
    email: String(onb.email ?? "").trim(),
    requestId,
    verifyLink,
    regtankStatus: st || null,
    kycBlock: kycKeys.length ? scr.kyc : null,
    amlBlock: amlKeys.length ? scr.aml : null,
  };
}
