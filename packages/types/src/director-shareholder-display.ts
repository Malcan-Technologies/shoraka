/**
 * SECTION: Director / shareholder display rows
 * WHY: One source of truth for issuer profile, company-details step, and admin financial tab
 * INPUT: corporate_entities JSON, director_kyc_status JSON, optional organization CTOS company_json
 * OUTPUT: merged rows (CTOS: one row per IC/SSM; onboarding: existing merge) with strict ID matching
 * WHERE USED: apps/issuer, apps/admin (via @cashsouk/types)
 */

import { governmentIdFromDirectorKycForEod } from "./director-kyc-gov-id";
import {
  effectiveCtosRegtankStatusFromOnboardingJson,
  getDisplayAmlStatus,
} from "./regtank-onboarding-status";

export type DirectorShareholderPartyType = "INDIVIDUAL" | "COMPANY";

export interface DirectorShareholderDisplayRow {
  id: string;
  name: string;
  role: string;
  type: DirectorShareholderPartyType;
  idNumber: string | null;
  registrationNumber: string | null;
  /** Share ownership label, e.g. `10% ownership`, for application-flow layout. */
  ownershipDisplay: string | null;
  email: string;
  /** Unified KYC label (`getDisplayKycStatus` / legacy mapper) or `"Sent"` when link-sent override applies. */
  status: string;
  canEnterEmail: boolean;
  canSendOnboarding: boolean;
  /** Admin CTOS subject enquiry (IC / SSM / EOD). */
  enquiryId: string | null;
  subjectKind: "INDIVIDUAL" | "CORPORATE" | null;
  /** CTOS party: RegTank link sent (supplement.sent). Drives row chrome without overloading `status`. */
  ctosOnboardingLinkSent?: boolean;
  /** Raw internal RegTank status (reg_tank_onboarding semantics) when CTOS supplement exists. */
  ctosRegtankStatus?: string | null;
  /** Human-readable AML label (`getDisplayAmlStatus`); set only when an AML source exists for the row. */
  amlStatus?: string | null;
  /**
   * CTOS-backed rows only: false when the party must not receive individual RegTank onboarding
   * (e.g. corporate shareholder or individual &lt;5% shareholder-only). Omitted for onboarding/KYC-only rows.
   */
  ctosIndividualKycEligible?: boolean;
  /** Populated for CTOS-backed individuals; drives `getDisplayRoleLabel` in UIs. */
  isDirector?: boolean;
  isShareholder?: boolean;
  sharePercentage?: number | null;
}

export function getDisplayRoleLabel(row: {
  isDirector: boolean;
  isShareholder: boolean;
  sharePercentage?: number | null;
}): string {
  const roles: string[] = [];

  if (row.isDirector) {
    roles.push("Director");
  }

  const share = Number(row.sharePercentage ?? 0);

  if (row.isShareholder && share >= 5) {
    roles.push(`Shareholder (${share}%)`);
  }

  return roles.join(", ");
}

export type UnifiedDisplayKycStatus =
  | "KYC Approved"
  | "KYC Pending"
  | "Not Started"
  | "KYC Failed"
  | "Status unavailable";

const KNOWN_PENDING_STATUSES = new Set([
  "IN_PROGRESS",
  "PENDING",
  "PENDING_AML",
  "FORM_FILLING",
  "LIVENESS_PASSED",
  "PENDING_APPROVAL",
  "WAIT_FOR_APPROVAL",
  /** Common director_kyc_status / RegTank in-progress values not listed above */
  "EMAIL_SENT",
  "LIVENESS_STARTED",
  "ID_UPLOADED",
  "CHECKED",
]);

function normalizeKycStatusToken(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toUpperCase();
}

export type UnifiedOnboardingState = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED";

/**
 * Canonical display label for KYC/onboarding state across portals.
 * - missing requestId -> Not Started
 * - REJECTED / FAILED (any of regtank / kyc / raw) -> KYC Failed
 * - APPROVED (any) -> KYC Approved
 * - known in-progress tokens (any) -> KYC Pending
 * - anything else -> Status unavailable (not treated as pending)
 */
export function getDisplayKycStatus(input: {
  requestId?: string | null;
  regtankStatus?: string | null;
  kycRawStatus?: string | null;
  rawStatus?: string | null;
}): UnifiedDisplayKycStatus {
  const requestId = normalizeKycStatusToken(input.requestId);
  if (!requestId) return "Not Started";

  const rt = normalizeKycStatusToken(input.regtankStatus);
  const kycRaw = normalizeKycStatusToken(input.kycRawStatus);
  const raw = normalizeKycStatusToken(input.rawStatus);

  const tokens = [rt, kycRaw, raw].filter((t) => t.length > 0);

  if (tokens.some((t) => t === "REJECTED" || t === "FAILED")) {
    return "KYC Failed";
  }
  if (tokens.some((t) => t === "APPROVED")) {
    return "KYC Approved";
  }
  if (tokens.some((t) => KNOWN_PENDING_STATUSES.has(t))) {
    return "KYC Pending";
  }

  if (tokens.length > 0) {
    console.warn("Unknown KYC status:", {
      regtankStatus: input.regtankStatus,
      kycRawStatus: input.kycRawStatus,
      rawStatus: input.rawStatus,
    });
  }
  return "Status unavailable";
}

/** Maps legacy `director_kyc_status` / COD raw strings to the same labels as CTOS `getDisplayKycStatus`. */
function legacyDirectorKycRawToUnifiedDisplay(raw: string): UnifiedDisplayKycStatus {
  const t = normalizeKycStatusToken(raw);
  if (!t) return "Not Started";
  if (t === "NOT REQUESTED") return "Not Started";
  if (t === "MISSING") return "Not Started";
  if (t === "REJECTED" || t === "FAILED") return "KYC Failed";
  if (t === "APPROVED") return "KYC Approved";
  if (KNOWN_PENDING_STATUSES.has(t)) return "KYC Pending";
  return getDisplayKycStatus({
    requestId: "legacy",
    regtankStatus: raw,
    kycRawStatus: raw,
    rawStatus: raw,
  });
}

/**
 * Canonical onboarding state for latest onboarding only.
 */
export function getOnboardingState(input: {
  requestId?: string | null;
  regtankStatus?: string | null;
  kycRawStatus?: string | null;
}): UnifiedOnboardingState {
  const requestId = String(input.requestId ?? "").trim();
  if (!requestId) return "NOT_STARTED";

  const regtankStatus = String(input.regtankStatus ?? "").trim().toUpperCase();
  const kycRawStatus = String(input.kycRawStatus ?? "").trim().toUpperCase();

  if (regtankStatus === "APPROVED" || kycRawStatus === "APPROVED") return "APPROVED";
  if (regtankStatus === "WAIT_FOR_APPROVAL" || regtankStatus === "PENDING_APPROVAL") return "SUBMITTED";
  return "IN_PROGRESS";
}

/**
 * Canonical person inclusion rule:
 * - Directors always included
 * - Individual shareholders included only when >= 5%
 * - Corporate shareholders always included
 */
export function shouldIncludePerson(input: {
  type: DirectorShareholderPartyType;
  isDirector?: boolean;
  isShareholder?: boolean;
  sharePercentage?: number | null;
}): boolean {
  if (input.type === "COMPANY") return true;
  if (input.isDirector) return true;
  if (input.isShareholder) return Number(input.sharePercentage ?? 0) >= 5;
  return false;
}

/**
 * Backward-compatible wrapper for callers that want an explicit "build" function.
 */
export function buildUnifiedDirectorShareholderList(
  input: GetDirectorShareholderDisplayRowsInput
): DirectorShareholderDisplayRow[] {
  return getDirectorShareholderDisplayRows(input);
}

export interface CtosPartySupplementInput {
  partyKey: string;
  /** Persisted `ctos_party_supplements.onboarding_json` (email, sent, requestId, …). */
  onboardingJson?: unknown;
}

export interface GetDirectorShareholderDisplayRowsInput {
  corporateEntities: unknown;
  directorKycStatus: unknown;
  /** Issuer JSON `director_aml_status` for AML fallback when matching by IC / kycId (optional). */
  directorAmlStatus?: unknown;
  organizationCtosCompanyJson?: unknown | null;
  /** CTOS party supplements: party key + onboarding_json blob. */
  ctosPartySupplements?: ReadonlyArray<CtosPartySupplementInput> | null;
  /** Row ids (from this helper) marked as onboarding link sent (issuer UI only). */
  sentRowIds?: ReadonlySet<string> | null;
}

/**
 * Canonical identity normalization for party keys, CTOS merge keys, supplement lookup, and legacy ID match.
 * Trim, uppercase, strip non-alphanumerics (e.g. "S123-4567-A" and "S1234567A" both become "S1234567A").
 */
export function normalizeStrictPartyId(id: string | null | undefined): string {
  return String(id ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Same rules as {@link normalizeStrictPartyId}; returns null when the normalized id is empty (existing API shape). */
export function normalizeDirectorShareholderIdKey(raw: string | null | undefined): string | null {
  const s = normalizeStrictPartyId(raw);
  return s.length ? s : null;
}

type LegacyKycPersonRecord = Record<string, unknown>;

function findLegacyKycPersonByStrictId(
  strictKey: string,
  directorKycStatus: Record<string, unknown> | null | undefined
): LegacyKycPersonRecord | null {
  if (!strictKey || !directorKycStatus || typeof directorKycStatus !== "object") return null;
  const dirs = Array.isArray(directorKycStatus.directors)
    ? (directorKycStatus.directors as LegacyKycPersonRecord[])
    : [];
  for (const d of dirs) {
    if (normalizeStrictPartyId(String(d.governmentIdNumber ?? "")) === strictKey) return d;
  }
  const sh = Array.isArray(directorKycStatus.individualShareholders)
    ? (directorKycStatus.individualShareholders as LegacyKycPersonRecord[])
    : [];
  for (const s of sh) {
    if (normalizeStrictPartyId(String(s.governmentIdNumber ?? "")) === strictKey) return s;
  }
  return null;
}

function collectDirectorAmlIndividualEntries(
  directorAmlStatus: Record<string, unknown> | null | undefined
): Record<string, unknown>[] {
  if (!directorAmlStatus || typeof directorAmlStatus !== "object") return [];
  const dirs = Array.isArray((directorAmlStatus as { directors?: unknown }).directors)
    ? ((directorAmlStatus as { directors: unknown[] }).directors as Record<string, unknown>[])
    : [];
  const sh = Array.isArray((directorAmlStatus as { individualShareholders?: unknown }).individualShareholders)
    ? ((directorAmlStatus as { individualShareholders: unknown[] }).individualShareholders as Record<string, unknown>[])
    : [];
  return [...dirs, ...sh];
}

function legacyAmlRawFromMatch(match: Record<string, unknown> | null): string | null {
  if (!match) return null;
  const amlSt = match.amlStatus;
  if (amlSt == null || String(amlSt).trim() === "") return null;
  return String(amlSt).trim();
}

/**
 * Match `director_aml_status` individual entries by `eodRequestId` when provided, else by `kycId`.
 * Does not use name or IC. When `eodRequestId` is set, kycId is not used for matching (split director vs shareholder rows).
 */
function findLegacyAmlMatch(
  row: { kycId?: string | null; eodRequestId?: string | null },
  directorAmlStatus: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  const entries = collectDirectorAmlIndividualEntries(directorAmlStatus);
  const reod = String(row.eodRequestId ?? "").trim();
  const rkyc = String(row.kycId ?? "").trim();

  if (reod) {
    return entries.find((d) => String(d.eodRequestId ?? "").trim() === reod) ?? null;
  }
  if (rkyc) {
    return entries.find((d) => String(d.kycId ?? "").trim() === rkyc) ?? null;
  }
  return null;
}

function findLegacyKycPersonByEod(
  eod: string | null | undefined,
  directorKycStatus: Record<string, unknown> | null | undefined
): LegacyKycPersonRecord | null {
  const e = String(eod ?? "").trim();
  if (!e || !directorKycStatus || typeof directorKycStatus !== "object") return null;
  const dirs = Array.isArray(directorKycStatus.directors)
    ? (directorKycStatus.directors as LegacyKycPersonRecord[])
    : [];
  for (const d of dirs) {
    if (String(d.eodRequestId ?? "").trim() === e || String(d.shareholderEodRequestId ?? "").trim() === e) {
      return d;
    }
  }
  const sh = Array.isArray(directorKycStatus.individualShareholders)
    ? (directorKycStatus.individualShareholders as LegacyKycPersonRecord[])
    : [];
  for (const s of sh) {
    if (String(s.eodRequestId ?? "").trim() === e) return s;
  }
  return null;
}

/** AML for onboarding buckets: when the row has an EOD, match AML by that EOD only. */
function findLegacyAmlRawForOnboardingRow(
  icKey: string | null,
  eod: string | null,
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined
): string | null {
  const e = String(eod ?? "").trim();
  const person =
    (e ? findLegacyKycPersonByEod(e, directorKycStatus) : null) ||
    (icKey ? findLegacyKycPersonByStrictId(icKey, directorKycStatus) : null);
  if (!person) return null;
  if (e) {
    return legacyAmlRawFromMatch(findLegacyAmlMatch({ kycId: null, eodRequestId: e }, directorAmlStatus));
  }
  return findLegacyAmlRawForKycPerson(person, directorAmlStatus);
}

function findLegacyAmlRawForKycPerson(
  person: LegacyKycPersonRecord,
  directorAmlStatus: Record<string, unknown> | null | undefined
): string | null {
  if (!directorAmlStatus || typeof directorAmlStatus !== "object") return null;
  const kycId = String(person.kycId ?? "").trim();
  const eodPrimary = String(person.eodRequestId ?? "").trim();
  const eodSh = String(person.shareholderEodRequestId ?? "").trim();
  const hadEod = Boolean(eodPrimary || eodSh);
  const eodOrder = [eodPrimary, eodSh].filter((x, i, a) => x && a.indexOf(x) === i);

  for (const eod of eodOrder) {
    const raw = legacyAmlRawFromMatch(findLegacyAmlMatch({ kycId: null, eodRequestId: eod }, directorAmlStatus));
    if (raw) return raw;
  }
  if (kycId && !hadEod) {
    return legacyAmlRawFromMatch(findLegacyAmlMatch({ kycId, eodRequestId: null }, directorAmlStatus));
  }
  return null;
}

function findLegacyBusinessKycAmlByStrictReg(
  strictReg: string,
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined
): { kycRaw: string | null; amlRaw: string | null; legacyEmail: string | null } {
  const empty = { kycRaw: null as string | null, amlRaw: null as string | null, legacyEmail: null as string | null };
  if (!strictReg || !directorKycStatus || typeof directorKycStatus !== "object") return empty;
  const biz = Array.isArray(directorKycStatus.businessShareholders)
    ? (directorKycStatus.businessShareholders as LegacyKycPersonRecord[])
    : [];
  for (const b of biz) {
    const regRaw = String(
      b.businessRegistrationNumber ??
        b.ssmNumber ??
        b.companyRegistrationNumber ??
        b.ssmRegistrationNumber ??
        ""
    ).trim();
    if (normalizeStrictPartyId(regRaw) !== strictReg) continue;
    const kycRaw =
      b.kybStatus != null && String(b.kybStatus).trim() !== ""
        ? String(b.kybStatus)
        : b.kycStatus != null && String(b.kycStatus).trim() !== ""
          ? String(b.kycStatus)
          : null;
    const legacyEmail = b.email != null ? String(b.email).trim() : "";
    let amlRaw: string | null = null;
    if (directorAmlStatus && typeof directorAmlStatus === "object") {
      const amlBiz = Array.isArray((directorAmlStatus as { businessShareholders?: unknown }).businessShareholders)
        ? ((directorAmlStatus as { businessShareholders: LegacyKycPersonRecord[] }).businessShareholders as LegacyKycPersonRecord[])
        : [];
      const kybId = String(b.kybId ?? "").trim();
      const codId = String(b.codRequestId ?? "").trim();
      for (const a of amlBiz) {
        const aKyb = String(a.kybId ?? "").trim();
        const aCod = String(a.codRequestId ?? "").trim();
        if (kybId && aKyb === kybId && a.amlStatus != null && String(a.amlStatus).trim() !== "") {
          amlRaw = String(a.amlStatus).trim();
          break;
        }
        if (codId && aCod === codId && a.amlStatus != null && String(a.amlStatus).trim() !== "") {
          amlRaw = String(a.amlStatus).trim();
          break;
        }
      }
    }
    return { kycRaw, amlRaw, legacyEmail: legacyEmail || null };
  }
  return empty;
}

function findLegacyKycAmlByStrictIdForCtosRow(
  bucket: {
    type: DirectorShareholderPartyType;
    idNumber: string | null;
    registrationNumber: string | null;
    enquiryId: string | null;
  },
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined
): { kycRaw: string | null; amlRaw: string | null; legacyEmail: string | null } {
  const empty = { kycRaw: null as string | null, amlRaw: null as string | null, legacyEmail: null as string | null };
  if (bucket.type === "COMPANY") {
    const strictReg = normalizeStrictPartyId(bucket.registrationNumber || bucket.enquiryId || "");
    if (!strictReg) return empty;
    return findLegacyBusinessKycAmlByStrictReg(strictReg, directorKycStatus, directorAmlStatus);
  }
  const strictIc = normalizeStrictPartyId(bucket.idNumber || bucket.enquiryId || "");
  if (!strictIc) return empty;
  const person = findLegacyKycPersonByStrictId(strictIc, directorKycStatus);
  if (!person) return empty;
  const kycRaw = person.kycStatus != null && String(person.kycStatus).trim() !== "" ? String(person.kycStatus) : null;
  const legacyEmail = person.email != null ? String(person.email).trim() : "";
  const amlRaw = findLegacyAmlRawForKycPerson(person, directorAmlStatus);
  return { kycRaw, amlRaw, legacyEmail: legacyEmail || null };
}

function parseCtosPartyOnboardingJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function buildSupplementDerivedMaps(supplements: ReadonlyArray<CtosPartySupplementInput> | null | undefined): {
  emailByPartyKey: Map<string, string>;
  sentPartyKeys: Set<string>;
  regtankStatusByPartyKey: Map<string, string>;
  onboardingByPartyKey: Map<string, Record<string, unknown>>;
  supplementPartyKeys: Set<string>;
} {
  const emailByPartyKey = new Map<string, string>();
  const sentPartyKeys = new Set<string>();
  const regtankStatusByPartyKey = new Map<string, string>();
  const onboardingByPartyKey = new Map<string, Record<string, unknown>>();
  const supplementPartyKeys = new Set<string>();
  if (!supplements?.length) {
    return {
      emailByPartyKey,
      sentPartyKeys,
      regtankStatusByPartyKey,
      onboardingByPartyKey,
      supplementPartyKeys,
    };
  }
  for (const row of supplements) {
    const k = normalizeDirectorShareholderIdKey(row.partyKey);
    if (!k) continue;
    supplementPartyKeys.add(k);
    const ob = parseCtosPartyOnboardingJson(row.onboardingJson);
    onboardingByPartyKey.set(k, ob);
    const em = ob.email != null ? String(ob.email).trim() : "";
    if (em) emailByPartyKey.set(k, em);
    if (ob.sent === true) sentPartyKeys.add(k);
    const rs = effectiveCtosRegtankStatusFromOnboardingJson(ob);
    if (rs) regtankStatusByPartyKey.set(k, rs);
  }
  return {
    emailByPartyKey,
    sentPartyKeys,
    regtankStatusByPartyKey,
    onboardingByPartyKey,
    supplementPartyKeys,
  };
}

export interface CtosCompanyJsonDirectorEntry {
  ic_lcno: string | null;
  nic_brno: string | null;
  name: string | null;
  position: string | null;
  equity_percentage: number | null;
  equity: number | null;
  party_type: string | null;
}

type CtosOrgDirectorRow = CtosCompanyJsonDirectorEntry;

const CTOS_POSITION_CODES = new Set(["DO", "SO", "DS", "AD", "AS"]);

function extractCtosOrgDirectorsFromCompanyJson(companyJson: unknown): CtosOrgDirectorRow[] {
  const cj = companyJson as { directors?: unknown } | null | undefined;
  const raw = Array.isArray(cj?.directors) ? cj!.directors : [];
  const out: CtosOrgDirectorRow[] = [];
  for (const d of raw) {
    const x = d as Record<string, unknown>;
    const ptRaw = x.party_type != null ? String(x.party_type).trim() : "";
    const icLc =
      x.ic_lcno != null && String(x.ic_lcno).trim() !== ""
        ? String(x.ic_lcno)
        : x.ic_no != null && String(x.ic_no).trim() !== ""
          ? String(x.ic_no)
          : null;
    out.push({
      ic_lcno: icLc,
      nic_brno: x.nic_brno != null ? String(x.nic_brno) : null,
      name: x.name != null ? String(x.name) : null,
      position: x.position != null ? String(x.position) : null,
      equity_percentage: typeof x.equity_percentage === "number" ? x.equity_percentage : null,
      equity: typeof x.equity === "number" ? x.equity : null,
      party_type: ptRaw !== "" ? ptRaw : null,
    });
  }
  return out;
}

/** IC / government id display for individual CTOS parties (prefer ic_lcno). */
function individualCtosIdDisplayRaw(r: CtosOrgDirectorRow): string {
  const ic = (r.ic_lcno ?? "").trim();
  const nic = (r.nic_brno ?? "").trim();
  return ic || nic;
}

/** SSM / registration display for corporate CTOS parties (prefer nic_brno). */
function corporateCtosRegDisplayRaw(r: CtosOrgDirectorRow): string {
  const ssm = (r.nic_brno ?? "").trim();
  const ic = (r.ic_lcno ?? "").trim();
  return ssm || ic;
}

/**
 * Normalized merge key for CTOS rows: same person → one bucket.
 * INDIVIDUAL → IC / gov id; COMPANY → SSM / registration (not name-based). Uses {@link normalizeStrictPartyId} rules.
 */
function ctosPartyNormalizedMergeKey(
  r: CtosOrgDirectorRow,
  kind: "INDIVIDUAL" | "CORPORATE" | null
): string | null {
  if (kind === "INDIVIDUAL") {
    return normalizeDirectorShareholderIdKey(individualCtosIdDisplayRaw(r) || null);
  }
  if (kind === "CORPORATE") {
    return normalizeDirectorShareholderIdKey(corporateCtosRegDisplayRaw(r) || null);
  }
  return null;
}

function ctosPositionCanonicalCode(position: string | null | undefined): string | null {
  const p = String(position ?? "").trim().toUpperCase();
  if (CTOS_POSITION_CODES.has(p)) return p;
  return null;
}

const CTOS_DIRECTOR_POSITION_CODES = new Set(["DO", "AD", "DS", "AS"]);
const CTOS_SHAREHOLDER_POSITION_CODES = new Set(["SO", "DS", "AS"]);

function equitySharePercentageFromCtosRow(r: CtosOrgDirectorRow): number {
  if (r.equity_percentage != null && Number.isFinite(Number(r.equity_percentage))) {
    return Number(r.equity_percentage);
  }
  if (r.equity != null && Number.isFinite(Number(r.equity))) {
    return Number(r.equity);
  }
  return 0;
}

function ctosDirectorShareholderFlagsFromCanonicalCode(code: string | null): {
  isDirector: boolean;
  isShareholder: boolean;
} {
  if (!code) return { isDirector: false, isShareholder: false };
  return {
    isDirector: CTOS_DIRECTOR_POSITION_CODES.has(code),
    isShareholder: CTOS_SHAREHOLDER_POSITION_CODES.has(code),
  };
}

/**
 * CTOS company_json director row: include in unified profile lists.
 * Corporate parties are always listed; individuals use director OR ≥5% shareholder rule.
 */
export function shouldIncludeCtosCompanyJsonDirectorEntry(
  subjectKind: "INDIVIDUAL" | "CORPORATE" | null,
  r: CtosCompanyJsonDirectorEntry
): boolean {
  if (subjectKind === "CORPORATE") return true;
  const code = ctosPositionCanonicalCode(r.position);
  if (!code) return true;
  const { isDirector, isShareholder } = ctosDirectorShareholderFlagsFromCanonicalCode(code);
  const share = equitySharePercentageFromCtosRow(r);
  return isDirector || (isShareholder && share >= 5);
}

export interface CtosUnifiedDirectorShareholderParty {
  name: string;
  ic: string;
  isDirector: boolean;
  isShareholder: boolean;
  sharePercentage: number;
  isIndividual: boolean;
}

/**
 * Rebuilds one row per CTOS party key from company_json.directors (filtered; no stored merge).
 */
export function buildUnifiedCtosDirectorShareholdersFromCompanyJson(
  companyJson: unknown
): CtosUnifiedDirectorShareholderParty[] {
  const ctosList = extractCtosOrgDirectorsFromCompanyJson(companyJson);
  type Bucket = {
    name: string;
    isDirector: boolean;
    isShareholder: boolean;
    sharePct: number;
    isIndividual: boolean;
    icDisplay: string;
  };
  const merged = new Map<string, Bucket>();
  const keyOrder: string[] = [];
  let anonSeq = 0;

  for (const cr of ctosList) {
    const kind = directorSubjectKindFromCtosOrgRow(cr);
    if (!shouldIncludeCtosCompanyJsonDirectorEntry(kind, cr)) continue;
    const isIndividual = kind !== "CORPORATE";
    const lookupKey = ctosPartyNormalizedMergeKey(cr, kind);
    const mapKey = lookupKey ?? `__anon_${anonSeq++}`;
    const code = ctosPositionCanonicalCode(cr.position);
    const { isDirector, isShareholder } = ctosDirectorShareholderFlagsFromCanonicalCode(code);
    const sharePct = equitySharePercentageFromCtosRow(cr);
    const icDisplay = isIndividual ? individualCtosIdDisplayRaw(cr) : corporateCtosRegDisplayRaw(cr);

    const existing = merged.get(mapKey);
    if (!existing) {
      merged.set(mapKey, {
        name: (cr.name ?? "").trim() || "Unknown",
        isDirector,
        isShareholder,
        sharePct,
        isIndividual,
        icDisplay: icDisplay.trim(),
      });
      keyOrder.push(mapKey);
    } else {
      existing.isDirector = existing.isDirector || isDirector;
      existing.isShareholder = existing.isShareholder || isShareholder;
      existing.sharePct = Math.max(existing.sharePct, sharePct);
      const nm = (cr.name ?? "").trim();
      if (nm && (existing.name === "Unknown" || !existing.name.trim())) {
        existing.name = nm;
      }
      const idd = icDisplay.trim();
      if (idd && !existing.icDisplay.trim()) {
        existing.icDisplay = idd;
      }
    }
  }

  const out: CtosUnifiedDirectorShareholderParty[] = [];
  for (const mapKey of keyOrder) {
    const b = merged.get(mapKey)!;
    out.push({
      name: b.name,
      ic: b.icDisplay,
      isDirector: b.isDirector,
      isShareholder: b.isShareholder,
      sharePercentage: b.sharePct,
      isIndividual: b.isIndividual,
    });
  }
  return out;
}

/** True when the issuer may collect email and send individual RegTank onboarding for this row. */
export function isCtosIndividualKycEligibleRow(row: DirectorShareholderDisplayRow): boolean {
  if (row.type !== "INDIVIDUAL") return false;
  if (row.ctosIndividualKycEligible === false) return false;
  return true;
}

function directorSubjectKindFromCtosOrgRow(r: CtosOrgDirectorRow): "INDIVIDUAL" | "CORPORATE" | null {
  if (r.party_type === "I") return "INDIVIDUAL";
  if (r.party_type === "C") return "CORPORATE";
  const nic = (r.nic_brno ?? "").trim();
  const ic = (r.ic_lcno ?? "").trim();
  if (nic && !ic) return "INDIVIDUAL";
  if (ic && !nic) return "CORPORATE";
  if (nic) return "INDIVIDUAL";
  if (ic) return "CORPORATE";
  return null;
}

function ownershipFromCePerson(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const shareField = content.find((f) => f.fieldName === "% of Shares");
  return shareField?.fieldValue ? `${shareField.fieldValue}% ownership` : null;
}

/** Parsed % of shares for corporate_entities individual (director or shareholder CE record). */
function percentOfSharesFromOnboardingCePerson(p: Record<string, unknown>): number {
  const rawTop = p.percentOfShares ?? p.sharePercentage ?? p.share_percentage;
  if (typeof rawTop === "number" && Number.isFinite(rawTop)) return rawTop;
  if (typeof rawTop === "string" && rawTop.trim() !== "") {
    const n = Number.parseFloat(rawTop.trim().replace(/[%\s,]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const shareField = content.find((f) => f.fieldName === "% of Shares");
  if (shareField?.fieldValue == null || String(shareField.fieldValue).trim() === "") return 0;
  const n = Number.parseFloat(String(shareField.fieldValue).trim().replace(/[%\s,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function ownershipFromCorpShareholder(corp: Record<string, unknown>): string | null {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    const content = Array.isArray((area as Record<string, unknown>)?.content)
      ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
      : [];
    const shareField = content.find((f) => f.fieldName === "% of Shares");
    if (shareField?.fieldValue) return `${shareField.fieldValue}% ownership`;
  }
  return null;
}

function ownershipFromCtosDirectorRow(r: CtosOrgDirectorRow): string | null {
  if (r.equity_percentage != null && !Number.isNaN(Number(r.equity_percentage))) {
    return `${r.equity_percentage}% ownership`;
  }
  if (r.equity != null && !Number.isNaN(Number(r.equity))) {
    return `${r.equity}% ownership`;
  }
  return null;
}

function ownershipFromKycRoleString(roleStr: string): string | null {
  const m = roleStr.match(/\((\d+)%\)/);
  return m ? `${m[1]}% ownership` : null;
}

/** Parses `(12%)` or `(12.5%)` from synced KYC role text; null if absent. */
function parseShareFromRoleString(role: string): number | null {
  const m = role.match(/\(\s*([\d.]+)\s*%\s*\)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function personNameFromCe(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const full = String(info?.fullName ?? "").trim();
  if (full) return full;
  const first = String(info?.firstName ?? "").trim();
  const last = String(info?.lastName ?? "").trim();
  const joined = [first, last].filter(Boolean).join(" ");
  return joined || "Unknown";
}

function emailFromCePerson(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const e = info?.email != null ? String(info.email).trim() : "";
  return e;
}

function issuerIcOrSsmFromCorpPerson(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const fromTop = String(info?.governmentIdNumber ?? "").trim();
  if (fromTop) return fromTop;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const idField = content.find((f) => f.fieldName === "Government ID Number");
  if (idField?.fieldValue) return String(idField.fieldValue).trim();
  return null;
}

function issuerIcOrSsmForCePersonRow(
  p: Record<string, unknown>,
  directorKycStatus: Record<string, unknown> | null | undefined
): string | null {
  const fromCe = issuerIcOrSsmFromCorpPerson(p);
  if (fromCe) return fromCe;
  const eod = String(p.eodRequestId ?? "").trim();
  return governmentIdFromDirectorKycForEod(directorKycStatus, eod);
}

function findKycStatusForEod(
  directorKycStatus: Record<string, unknown> | null | undefined,
  eod: string
): string | null {
  if (!eod) return null;
  const dirs = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  for (const d of dirs) {
    const primary = String(d.eodRequestId ?? "").trim();
    const shareholderEod = String(d.shareholderEodRequestId ?? "").trim();
    if ((primary === eod || shareholderEod === eod) && d.kycStatus) return String(d.kycStatus);
  }
  const sh = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of sh) {
    if (String(s.eodRequestId ?? "").trim() === eod && s.kycStatus) return String(s.kycStatus);
  }
  return null;
}

interface KycByIdEntry {
  email: string;
  status: string | null;
  requestId: string | null;
  /** When `kycId` is missing, EOD id still implies an onboarding request exists (legacy COD). */
  displayRequestId: string | null;
}

function buildKycByNormalizedId(directorKycStatus: Record<string, unknown> | null | undefined): Map<string, KycByIdEntry> {
  const m = new Map<string, KycByIdEntry>();
  const add = (rawId: unknown, email: unknown, status: unknown, requestId?: unknown, eodFallback?: unknown) => {
    const k = normalizeDirectorShareholderIdKey(rawId != null ? String(rawId) : null);
    if (!k) return;
    const em = email != null ? String(email).trim() : "";
    const st = status != null && String(status).trim() !== "" ? String(status) : null;
    const rid = requestId != null && String(requestId).trim() !== "" ? String(requestId).trim() : null;
    const eod =
      eodFallback != null && String(eodFallback).trim() !== "" ? String(eodFallback).trim() : null;
    const displayRequestId = rid || eod;
    const prev = m.get(k);
    if (!prev) {
      m.set(k, { email: em, status: st, requestId: rid, displayRequestId });
      return;
    }
    m.set(k, {
      email: em || prev.email,
      status: st ?? prev.status,
      requestId: rid ?? prev.requestId,
      displayRequestId: displayRequestId || prev.displayRequestId,
    });
  };
  const dirs = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  for (const d of dirs) {
    const eodPrimary = String(d.eodRequestId ?? "").trim();
    const eodSh = String(d.shareholderEodRequestId ?? "").trim();
    const eodPick = eodPrimary || eodSh || undefined;
    add(d.governmentIdNumber, d.email, d.kycStatus, d.kycId, eodPick);
  }
  const sh = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of sh) {
    add(s.governmentIdNumber, s.email, s.kycStatus, s.kycId, s.eodRequestId);
  }
  const biz = Array.isArray(directorKycStatus?.businessShareholders)
    ? (directorKycStatus!.businessShareholders as Record<string, unknown>[])
    : [];
  for (const b of biz) {
    add(
      b.businessRegistrationNumber ?? b.ssmNumber ?? b.companyRegistrationNumber,
      b.email,
      b.kybStatus ?? b.kycStatus,
      undefined,
      undefined
    );
  }
  return m;
}

function buildAmlByNormalizedGovId(
  directorAmlStatus: Record<string, unknown> | null | undefined,
  directorKycStatus: Record<string, unknown> | null | undefined
): Map<string, string> {
  const out = new Map<string, string>();
  if (!directorAmlStatus || typeof directorAmlStatus !== "object") return out;

  const linkPerson = (amlEntry: Record<string, unknown>) => {
    const amlSt = amlEntry.amlStatus;
    if (amlSt == null || String(amlSt).trim() === "") return;
    const amlStr = String(amlSt).trim();
    const kycId = String(amlEntry.kycId ?? "").trim();
    const eodId = String(amlEntry.eodRequestId ?? "").trim();

    const tryDirs = Array.isArray(directorKycStatus?.directors)
      ? (directorKycStatus!.directors as Record<string, unknown>[])
      : [];
    for (const d of tryDirs) {
      const gov = normalizeDirectorShareholderIdKey(String(d.governmentIdNumber ?? ""));
      if (!gov) continue;
      if (kycId && String(d.kycId ?? "").trim() === kycId) {
        out.set(gov, amlStr);
        return;
      }
      if (eodId) {
        const pe = String(d.eodRequestId ?? "").trim();
        const se = String(d.shareholderEodRequestId ?? "").trim();
        if (pe === eodId || se === eodId) {
          out.set(gov, amlStr);
          return;
        }
      }
    }
    const sh = Array.isArray(directorKycStatus?.individualShareholders)
      ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
      : [];
    for (const s of sh) {
      const gov = normalizeDirectorShareholderIdKey(String(s.governmentIdNumber ?? ""));
      if (!gov) continue;
      if (kycId && String(s.kycId ?? "").trim() === kycId) {
        out.set(gov, amlStr);
        return;
      }
      if (eodId && String(s.eodRequestId ?? "").trim() === eodId) {
        out.set(gov, amlStr);
        return;
      }
    }
  };

  const amlDirs = Array.isArray(directorAmlStatus.directors)
    ? (directorAmlStatus.directors as Record<string, unknown>[])
    : [];
  for (const a of amlDirs) linkPerson(a);

  const amlInd = Array.isArray(directorAmlStatus.individualShareholders)
    ? (directorAmlStatus.individualShareholders as Record<string, unknown>[])
    : [];
  for (const a of amlInd) linkPerson(a);

  return out;
}

function resolveIndividualStatus(
  icKey: string | null,
  eod: string | null,
  directorKycStatus: Record<string, unknown> | null | undefined,
  kycById: Map<string, KycByIdEntry>,
  ceStatus: string | null
): string {
  if (eod) {
    const st = findKycStatusForEod(directorKycStatus, eod);
    if (st) return st;
  }
  if (icKey) {
    const hit = kycById.get(icKey);
    if (hit?.status) return hit.status;
  }
  if (ceStatus) return ceStatus;
  return "Not requested";
}

function resolveCompanyStatus(
  regKey: string | null,
  kycById: Map<string, KycByIdEntry>,
  corp: Record<string, unknown>
): string {
  if (regKey) {
    const hit = kycById.get(regKey);
    if (hit?.status) return hit.status;
  }
  const st = corp.approveStatus ?? corp.status;
  if (st != null && String(st).trim() !== "") return String(st);
  return "Not requested";
}

function getCorpBusinessNumber(corp: Record<string, unknown>): string | null {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    const content = Array.isArray((area as Record<string, unknown>)?.content)
      ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
      : [];
    const numField = content.find((f) => f.fieldName === "Business Number");
    if (numField?.fieldValue) return String(numField.fieldValue).trim();
  }
  return null;
}

function getCorpDisplayName(corp: Record<string, unknown>): string {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  const basicInfo = displayAreas.find(
    (a: Record<string, unknown>) => a.displayArea === "Basic Information Setting"
  ) as { content?: Array<{ fieldName?: string; fieldValue?: string }> } | undefined;
  const content = Array.isArray(basicInfo?.content) ? basicInfo.content : [];
  const businessNameField = content.find((f) => f.fieldName === "Business Name");
  if (businessNameField?.fieldValue) return String(businessNameField.fieldValue);
  return String(corp.companyName || corp.businessName || "Unknown");
}

export function hasUsableCtosDirectorList(companyJson: unknown): boolean {
  const list = extractCtosOrgDirectorsFromCompanyJson(companyJson);
  return list.length > 0;
}

function buildOnboardingDisplayRows(
  corporateEntities: Record<string, unknown> | null | undefined,
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined,
  sentRowIds: ReadonlySet<string> | null | undefined
): DirectorShareholderDisplayRow[] {
  const kycById = buildKycByNormalizedId(directorKycStatus);
  const amlByGov = buildAmlByNormalizedGovId(directorAmlStatus, directorKycStatus);
  const directors = Array.isArray(corporateEntities?.directors)
    ? (corporateEntities!.directors as Record<string, unknown>[])
    : [];
  const shareholders = Array.isArray(corporateEntities?.shareholders)
    ? (corporateEntities!.shareholders as Record<string, unknown>[])
    : [];
  const corpShareholders = Array.isArray(corporateEntities?.corporateShareholders)
    ? (corporateEntities!.corporateShareholders as Record<string, unknown>[])
    : [];

  type IndBucket = {
    name: string;
    roles: Set<string>;
    email: string;
    icRaw: string | null;
    icKey: string | null;
    eod: string | null;
    ceStatus: string | null;
    ownershipDisplay: string | null;
    isDirector: boolean;
    isShareholder: boolean;
    sharePctMax: number;
  };

  const indBuckets = new Map<string, IndBucket>();
  const indOrder: string[] = [];

  const bucketKeyForIndividual = (icKey: string | null, eod: string | null, idx: number): string => {
    if (icKey) return `I:${icKey}`;
    if (eod) return `I:EOD:${eod}`;
    return `I:IDX:${idx}`;
  };

  let idxCounter = 0;
  const findExistingIndKey = (icKey: string | null, eod: string | null): string | null => {
    for (const k of indOrder) {
      const b = indBuckets.get(k)!;
      if (icKey && b.icKey === icKey) return k;
      if (eod && b.eod === eod) return k;
    }
    return null;
  };

  const mergeInd = (key: string, patch: Partial<IndBucket> & { addRole?: string }) => {
    const cur = indBuckets.get(key)!;
    if (patch.addRole) cur.roles.add(patch.addRole);
    if (patch.name && patch.name !== "Unknown") cur.name = patch.name;
    if (patch.email && patch.email.trim()) cur.email = patch.email.trim();
    if (patch.icRaw && !cur.icRaw) cur.icRaw = patch.icRaw;
    if (patch.icKey && !cur.icKey) cur.icKey = patch.icKey;
    if (patch.eod && !cur.eod) cur.eod = patch.eod;
    if (patch.ceStatus && !cur.ceStatus) cur.ceStatus = patch.ceStatus;
    const po = patch.ownershipDisplay != null ? String(patch.ownershipDisplay).trim() : "";
    if (po && !cur.ownershipDisplay) cur.ownershipDisplay = patch.ownershipDisplay ?? null;
    if (patch.sharePctMax != null && Number.isFinite(patch.sharePctMax)) {
      cur.sharePctMax = Math.max(cur.sharePctMax, patch.sharePctMax);
    }
    if (patch.isDirector === true) cur.isDirector = true;
    if (patch.isShareholder === true) cur.isShareholder = true;
  };

  const addInd = (icKey: string | null, eod: string | null, init: IndBucket) => {
    const existing = findExistingIndKey(icKey, eod);
    if (existing) {
      for (const r of init.roles) mergeInd(existing, { addRole: r });
      mergeInd(existing, {
        name: init.name,
        email: init.email,
        icRaw: init.icRaw,
        icKey: init.icKey,
        eod: init.eod,
        ceStatus: init.ceStatus,
        ownershipDisplay: init.ownershipDisplay,
        sharePctMax: init.sharePctMax,
        isDirector: init.isDirector,
        isShareholder: init.isShareholder,
      });
      return existing;
    }
    const key = bucketKeyForIndividual(icKey, eod, idxCounter++);
    indBuckets.set(key, init);
    indOrder.push(key);
    return key;
  };

  for (const p of directors) {
    const pr = p as Record<string, unknown>;
    const icRaw = issuerIcOrSsmForCePersonRow(p, directorKycStatus);
    const icKey = normalizeDirectorShareholderIdKey(icRaw);
    const eod = String(p.eodRequestId ?? "").trim() || null;
    const ceSt = (p.status ?? p.approveStatus) != null ? String(p.status ?? p.approveStatus) : null;
    const em = emailFromCePerson(p);
    const own = ownershipFromCePerson(p);
    const dirShare = percentOfSharesFromOnboardingCePerson(pr);
    addInd(icKey, eod, {
      name: personNameFromCe(p),
      roles: new Set(["Director"]),
      email: em,
      icRaw,
      icKey,
      eod,
      ceStatus: ceSt,
      ownershipDisplay: own,
      isDirector: true,
      isShareholder: false,
      sharePctMax: dirShare,
    });
  }

  for (const p of shareholders) {
    const pr = p as Record<string, unknown>;
    const share = percentOfSharesFromOnboardingCePerson(pr);
    if (share < 5) continue;

    const icRaw = issuerIcOrSsmForCePersonRow(p, directorKycStatus);
    const icKey = normalizeDirectorShareholderIdKey(icRaw);
    const eod = String(p.eodRequestId ?? "").trim() || null;
    const ceSt = (p.status ?? p.approveStatus) != null ? String(p.status ?? p.approveStatus) : null;
    const em = emailFromCePerson(p);
    const own = ownershipFromCePerson(p);
    const existingKey = findExistingIndKey(icKey, eod);
    if (existingKey) {
      mergeInd(existingKey, {
        addRole: "Shareholder",
        name: personNameFromCe(p),
        email: em,
        icRaw,
        icKey,
        eod,
        ceStatus: ceSt,
        ownershipDisplay: own,
        sharePctMax: share,
        isShareholder: true,
      });
    } else {
      addInd(icKey, eod, {
        name: personNameFromCe(p),
        roles: new Set(["Shareholder"]),
        email: em,
        icRaw,
        icKey,
        eod,
        ceStatus: ceSt,
        ownershipDisplay: own,
        isDirector: false,
        isShareholder: true,
        sharePctMax: share,
      });
    }
  }

  const rows: DirectorShareholderDisplayRow[] = [];

  for (const key of indOrder) {
    const b = indBuckets.get(key)!;
    const rawResolved = resolveIndividualStatus(b.icKey, b.eod, directorKycStatus, kycById, b.ceStatus);
    const unifiedBase = legacyDirectorKycRawToUnifiedDisplay(rawResolved);
    const emailFromKyc = b.icKey ? kycById.get(b.icKey)?.email ?? "" : "";
    const email = (b.email && b.email.trim()) || emailFromKyc;
    const id = `onb-ind-${key}`;
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : unifiedBase;
    const canBase = !sent && (!email.trim() || unifiedBase === "Not Started");
    const amlRaw = findLegacyAmlRawForOnboardingRow(b.icKey, b.eod, directorKycStatus, directorAmlStatus);
    const amlLine =
      amlRaw != null && String(amlRaw).trim() !== "" ? getDisplayAmlStatus(amlRaw) : undefined;
    const role =
      getDisplayRoleLabel({
        isDirector: b.isDirector,
        isShareholder: b.isShareholder,
        sharePercentage: b.sharePctMax,
      }) || "Director";
    rows.push({
      id,
      name: b.name,
      role,
      type: "INDIVIDUAL",
      idNumber: b.icRaw,
      registrationNumber: null,
      ownershipDisplay: b.ownershipDisplay,
      email,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: b.icRaw ? b.icRaw.trim() : b.eod,
      subjectKind: "INDIVIDUAL",
      isDirector: b.isDirector,
      isShareholder: b.isShareholder,
      sharePercentage: b.sharePctMax,
      amlStatus: amlLine,
    });
  }

  let corpIdx = 0;
  for (const corp of corpShareholders) {
    const regRaw = getCorpBusinessNumber(corp);
    const regKey = normalizeDirectorShareholderIdKey(regRaw);
    const id = `onb-corp-${regKey ?? corpIdx++}`;
    const rawResolved = resolveCompanyStatus(regKey, kycById, corp);
    const unifiedBase = legacyDirectorKycRawToUnifiedDisplay(rawResolved);
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : unifiedBase;
    const email = String((corp as Record<string, unknown>).email ?? "").trim();
    const corpOwn = ownershipFromCorpShareholder(corp);
    const corpAmlRaw = regKey ? amlByGov.get(regKey) : undefined;
    const corpAmlLine =
      corpAmlRaw != null && String(corpAmlRaw).trim() !== ""
        ? getDisplayAmlStatus(corpAmlRaw)
        : undefined;
    rows.push({
      id,
      name: getCorpDisplayName(corp),
      role: "Corporate Shareholder",
      type: "COMPANY",
      idNumber: null,
      registrationNumber: regRaw,
      ownershipDisplay: corpOwn,
      email,
      status,
      canEnterEmail: false,
      canSendOnboarding: false,
      enquiryId: regRaw ? regRaw.trim() : null,
      subjectKind: "CORPORATE",
      amlStatus: corpAmlLine,
    });
  }

  return rows;
}

/**
 * Parsed supplement fields for CTOS display.
 * `amlRaw` is for rendering only; {@link ctosSupplementHasMeaningfulOnboarding} ignores AML when deciding override.
 */
function ctosSupplementOnboardingFields(ob: Record<string, unknown>): {
  req: string;
  reg: string;
  kycRaw: string;
  amlRaw: string;
} {
  const req = String(ob.requestId ?? "").trim();
  const reg = String(ob.regtankStatus ?? "").trim();
  const kycRaw =
    ob.kyc && typeof ob.kyc === "object" && !Array.isArray(ob.kyc)
      ? String((ob.kyc as Record<string, unknown>).rawStatus ?? "").trim()
      : "";
  const amlRaw =
    ob.aml && typeof ob.aml === "object" && !Array.isArray(ob.aml)
      ? String((ob.aml as Record<string, unknown>).rawStatus ?? "").trim()
      : "";
  return { req, reg, kycRaw, amlRaw };
}

/** True when supplement should override legacy: real KYC / RegTank activity only (not aml.rawStatus alone). */
function ctosSupplementHasMeaningfulOnboarding(fields: {
  req: string;
  reg: string;
  kycRaw: string;
}): boolean {
  return Boolean(fields.req || fields.reg || fields.kycRaw);
}

function buildCtosBackedDisplayRows(
  companyJson: unknown,
  sentRowIds: ReadonlySet<string> | null | undefined,
  supplementEmailByPartyKey: ReadonlyMap<string, string>,
  supplementSentPartyKeys: ReadonlySet<string>,
  onboardingByPartyKey: ReadonlyMap<string, Record<string, unknown>>,
  supplementPartyKeys: ReadonlySet<string>,
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined
): DirectorShareholderDisplayRow[] {
  const ctosList = extractCtosOrgDirectorsFromCompanyJson(companyJson);

  type CtosMergedBucket = {
    name: string;
    type: DirectorShareholderPartyType;
    idNumber: string | null;
    registrationNumber: string | null;
    enquiryId: string | null;
    subjectKind: "INDIVIDUAL" | "CORPORATE" | null;
    lookupKey: string | null;
    ownershipDisplay: string | null;
    ctosIsDirector: boolean;
    ctosIsShareholder: boolean;
    ctosSharePct: number;
  };

  const merged = new Map<string, CtosMergedBucket>();
  const keyOrder: string[] = [];
  let anonSeq = 0;

  for (const cr of ctosList) {
    const kind = directorSubjectKindFromCtosOrgRow(cr);
    if (!shouldIncludeCtosCompanyJsonDirectorEntry(kind, cr)) continue;

    const lookupKey = ctosPartyNormalizedMergeKey(cr, kind);
    const mapKey = lookupKey ?? `__anon_${anonSeq++}`;

    const party: DirectorShareholderPartyType = kind === "CORPORATE" ? "COMPANY" : "INDIVIDUAL";
    const idDisp = individualCtosIdDisplayRaw(cr);
    const regDisp = corporateCtosRegDisplayRaw(cr);
    const own = ownershipFromCtosDirectorRow(cr);
    const posCode = ctosPositionCanonicalCode(cr.position);
    const { isDirector: rowIsDir, isShareholder: rowIsSh } = ctosDirectorShareholderFlagsFromCanonicalCode(posCode);
    const rowSharePct = equitySharePercentageFromCtosRow(cr);

    const existing = merged.get(mapKey);
    if (!existing) {
      merged.set(mapKey, {
        name: (cr.name ?? "").trim() || "Unknown",
        type: party,
        idNumber: party === "INDIVIDUAL" ? (idDisp || null) : null,
        registrationNumber: party === "COMPANY" ? (regDisp || null) : null,
        enquiryId: party === "INDIVIDUAL" ? (idDisp || null) : (regDisp || null),
        subjectKind: kind,
        lookupKey,
        ownershipDisplay: own,
        ctosIsDirector: rowIsDir,
        ctosIsShareholder: rowIsSh,
        ctosSharePct: rowSharePct,
      });
      keyOrder.push(mapKey);
    } else {
      existing.ctosIsDirector = existing.ctosIsDirector || rowIsDir;
      existing.ctosIsShareholder = existing.ctosIsShareholder || rowIsSh;
      existing.ctosSharePct = Math.max(existing.ctosSharePct, rowSharePct);
      const nm = (cr.name ?? "").trim();
      if (nm && (existing.name === "Unknown" || !existing.name.trim())) {
        existing.name = nm;
      }
      if (own && !existing.ownershipDisplay) {
        existing.ownershipDisplay = own;
      }
      if (existing.type === "INDIVIDUAL") {
        if (idDisp && !existing.idNumber?.trim()) {
          existing.idNumber = idDisp;
        }
        if (idDisp && !existing.enquiryId?.trim()) {
          existing.enquiryId = idDisp;
        }
      } else {
        if (regDisp && !existing.registrationNumber?.trim()) {
          existing.registrationNumber = regDisp;
        }
        if (regDisp && !existing.enquiryId?.trim()) {
          existing.enquiryId = regDisp;
        }
      }
    }
  }

  const rows: DirectorShareholderDisplayRow[] = [];
  let anonOut = 0;
  for (const mapKey of keyOrder) {
    const b = merged.get(mapKey)!;
    const idKeyNorm = b.lookupKey;
    const stableId = idKeyNorm ? `ctos-${idKeyNorm}` : `ctos-anon-${anonOut++}`;

    const hasSupplementRow = Boolean(idKeyNorm && supplementPartyKeys.has(idKeyNorm));
    const supOb: Record<string, unknown> | undefined = hasSupplementRow
      ? idKeyNorm
        ? onboardingByPartyKey.get(idKeyNorm) ?? {}
        : {}
      : undefined;

    const legacy = findLegacyKycAmlByStrictIdForCtosRow(b, directorKycStatus, directorAmlStatus);
    const legacyEmailForRow = legacy.legacyEmail;
    const hasLegacyData =
      (legacy.kycRaw != null && legacy.kycRaw.trim() !== "") ||
      (legacy.amlRaw != null && legacy.amlRaw.trim() !== "");

    const ob = hasSupplementRow ? (supOb ?? {}) : {};
    const supFields = ctosSupplementOnboardingFields(ob);
    const hasValidSupplement = hasSupplementRow && ctosSupplementHasMeaningfulOnboarding(supFields);

    let kycDisplay: UnifiedDisplayKycStatus = "Not Started";
    let amlLine: string | null = null;

    const applyLegacyKycAml = (): void => {
      const rawForUnified =
        legacy.kycRaw != null && legacy.kycRaw.trim() !== ""
          ? legacy.kycRaw
          : "Not requested";
      kycDisplay = legacyDirectorKycRawToUnifiedDisplay(rawForUnified);
      amlLine =
        legacy.amlRaw != null && legacy.amlRaw.trim() !== "" ? getDisplayAmlStatus(legacy.amlRaw) : null;
    };

    if (hasLegacyData && !hasValidSupplement) {
      applyLegacyKycAml();
    } else if (hasValidSupplement) {
      const { req, reg, kycRaw, amlRaw } = supFields;
      kycDisplay = getDisplayKycStatus({
        requestId: req || undefined,
        regtankStatus: reg || undefined,
        kycRawStatus: kycRaw || undefined,
        rawStatus: kycRaw || undefined,
      });
      amlLine = amlRaw ? getDisplayAmlStatus(amlRaw) : null;
    } else if (hasLegacyData) {
      applyLegacyKycAml();
    } else {
      kycDisplay = "Not Started";
      amlLine = null;
    }

    const fromSupplement = idKeyNorm ? supplementEmailByPartyKey.get(idKeyNorm) : undefined;
    const email =
      (fromSupplement && fromSupplement.trim()) ||
      (legacyEmailForRow && legacyEmailForRow.trim()) ||
      "";
    const linkSent =
      Boolean(sentRowIds?.has(stableId)) ||
      Boolean(idKeyNorm && supplementSentPartyKeys.has(idKeyNorm));
    const status = kycDisplay;
    const canBase = !linkSent && (!email.trim() || kycDisplay === "Not Started");
    const role =
      b.type === "COMPANY"
        ? "Corporate Shareholder"
        : getDisplayRoleLabel({
            isDirector: b.ctosIsDirector,
            isShareholder: b.ctosIsShareholder,
            sharePercentage: b.ctosSharePct,
          }) || "Director";
    const ctosIndividualKycEligible =
      b.type === "INDIVIDUAL" &&
      (b.ctosIsDirector || (b.ctosIsShareholder && b.ctosSharePct >= 5));

    rows.push({
      id: stableId,
      name: b.name,
      role,
      type: b.type,
      idNumber: b.idNumber,
      registrationNumber: b.registrationNumber,
      ownershipDisplay: b.ownershipDisplay,
      email,
      status,
      canEnterEmail: canBase && ctosIndividualKycEligible,
      canSendOnboarding: canBase && ctosIndividualKycEligible,
      enquiryId: b.enquiryId,
      subjectKind: b.subjectKind,
      ctosOnboardingLinkSent: linkSent,
      ctosRegtankStatus: null,
      amlStatus: amlLine,
      ctosIndividualKycEligible,
      isDirector: b.type === "INDIVIDUAL" ? b.ctosIsDirector : undefined,
      isShareholder: b.type === "INDIVIDUAL" ? b.ctosIsShareholder : undefined,
      sharePercentage: b.type === "INDIVIDUAL" ? b.ctosSharePct : undefined,
    });
  }
  return rows;
}

function buildKycOnlyFallbackRows(
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined,
  sentRowIds: ReadonlySet<string> | null | undefined
): DirectorShareholderDisplayRow[] {
  const rows: DirectorShareholderDisplayRow[] = [];
  let idx = 0;
  const kycDirs = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  for (const d of kycDirs) {
    const roleStr = d.role ? String(d.role) : "";
    const isDir = roleStr.toLowerCase().includes("director");
    const isSh = roleStr.toLowerCase().includes("shareholder");
    const sharePct = parseShareFromRoleString(roleStr) ?? 0;
    if (!isDir && isSh && sharePct < 5) continue;

    const gid = d.governmentIdNumber != null ? String(d.governmentIdNumber).trim() : "";
    const gKey = normalizeDirectorShareholderIdKey(gid);
    const eod = String(d.eodRequestId ?? "").trim();
    const id = `kyc-only-${gKey ?? eod ?? `i${idx++}`}`;
    const stRaw = d.kycStatus != null ? String(d.kycStatus) : null;
    const rawBase = stRaw && stRaw.trim() !== "" ? stRaw : "Not requested";
    const unifiedBase = legacyDirectorKycRawToUnifiedDisplay(rawBase);
    const emKyc = d.email != null ? String(d.email).trim() : "";
    const em = emKyc;
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : unifiedBase;
    const canBase = !sent && (!em || unifiedBase === "Not Started");
    const kycIdRow = String(d.kycId ?? "").trim();
    const amlRaw = legacyAmlRawFromMatch(
      findLegacyAmlMatch({ kycId: kycIdRow || null, eodRequestId: eod || null }, directorAmlStatus)
    );
    const amlLine =
      amlRaw != null && String(amlRaw).trim() !== "" ? getDisplayAmlStatus(amlRaw) : undefined;
    const ownK = ownershipFromKycRoleString(roleStr);
    const effectiveIsDirector = isDir || (!isDir && !isSh);
    const role =
      getDisplayRoleLabel({
        isDirector: effectiveIsDirector,
        isShareholder: isSh,
        sharePercentage: sharePct,
      }) || "Director";
    rows.push({
      id,
      name: String(d.name || "Unknown"),
      role,
      type: "INDIVIDUAL",
      idNumber: gid || null,
      registrationNumber: null,
      ownershipDisplay: ownK,
      email: em,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: gid || eod || null,
      subjectKind: "INDIVIDUAL",
      isDirector: effectiveIsDirector,
      isShareholder: isSh,
      sharePercentage: sharePct,
      amlStatus: amlLine,
    });
  }
  const kycSh = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of kycSh) {
    const gid = s.governmentIdNumber != null ? String(s.governmentIdNumber).trim() : "";
    const gKey = normalizeDirectorShareholderIdKey(gid);
    const eod = String(s.eodRequestId ?? "").trim();
    const id = `kyc-sh-${gKey ?? eod ?? `s${idx++}`}`;
    const dup = rows.find((r) => gKey && normalizeDirectorShareholderIdKey(r.idNumber) === gKey);
    if (dup) continue;
    const roleStrS = s.role ? String(s.role) : "";
    const isDirS = roleStrS.toLowerCase().includes("director");
    const isShS = roleStrS.toLowerCase().includes("shareholder");
    const sharePctS = parseShareFromRoleString(roleStrS) ?? 0;
    if (!isDirS && isShS && sharePctS < 5) continue;

    const stRaw = s.kycStatus != null ? String(s.kycStatus) : null;
    const rawBase = stRaw && stRaw.trim() !== "" ? stRaw : "Not requested";
    const unifiedBase = legacyDirectorKycRawToUnifiedDisplay(rawBase);
    const emKycS = s.email != null ? String(s.email).trim() : "";
    const em = emKycS;
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : unifiedBase;
    const canBase = !sent && (!em || unifiedBase === "Not Started");
    const kycIdS = String(s.kycId ?? "").trim();
    const eodS = String(s.eodRequestId ?? "").trim();
    const amlRawS = legacyAmlRawFromMatch(
      findLegacyAmlMatch({ kycId: kycIdS || null, eodRequestId: eodS || null }, directorAmlStatus)
    );
    const amlLineS =
      amlRawS != null && String(amlRawS).trim() !== "" ? getDisplayAmlStatus(amlRawS) : undefined;
    const ownS = ownershipFromKycRoleString(roleStrS);
    const effectiveDirS = isDirS || (!isDirS && !isShS);
    const role =
      getDisplayRoleLabel({
        isDirector: effectiveDirS,
        isShareholder: isShS,
        sharePercentage: sharePctS,
      }) || "Shareholder";
    rows.push({
      id,
      name: String(s.name || "Unknown"),
      role,
      type: "INDIVIDUAL",
      idNumber: gid || null,
      registrationNumber: null,
      ownershipDisplay: ownS,
      email: em,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: gid || eod || null,
      subjectKind: "INDIVIDUAL",
      isDirector: effectiveDirS,
      isShareholder: isShS,
      sharePercentage: sharePctS,
      amlStatus: amlLineS,
    });
  }
  return rows;
}

export function getDirectorShareholderDisplayRows(
  input: GetDirectorShareholderDisplayRowsInput
): DirectorShareholderDisplayRow[] {
  const corporateEntities = input.corporateEntities as Record<string, unknown> | null | undefined;
  const directorKycStatus = input.directorKycStatus as Record<string, unknown> | null | undefined;
  const sent = input.sentRowIds ?? null;
  const ctosJson = input.organizationCtosCompanyJson;
  const {
    emailByPartyKey: supplementEmailByPartyKey,
    sentPartyKeys: supplementSentPartyKeys,
    onboardingByPartyKey,
    supplementPartyKeys,
  } = buildSupplementDerivedMaps(input.ctosPartySupplements ?? null);

  const directorAmlJson =
    input.directorAmlStatus && typeof input.directorAmlStatus === "object"
      ? (input.directorAmlStatus as Record<string, unknown>)
      : null;

  const isCtosMode = hasUsableCtosDirectorList(ctosJson);
  if (isCtosMode) {
    return buildCtosBackedDisplayRows(
      ctosJson,
      sent,
      supplementEmailByPartyKey,
      supplementSentPartyKeys,
      onboardingByPartyKey,
      supplementPartyKeys,
      directorKycStatus,
      directorAmlJson
    );
  }

  const directors = Array.isArray(corporateEntities?.directors)
    ? (corporateEntities!.directors as Record<string, unknown>[])
    : [];
  const shareholders = Array.isArray(corporateEntities?.shareholders)
    ? (corporateEntities!.shareholders as Record<string, unknown>[])
    : [];
  const corp = Array.isArray(corporateEntities?.corporateShareholders)
    ? (corporateEntities!.corporateShareholders as Record<string, unknown>[])
    : [];

  if (directors.length > 0 || shareholders.length > 0 || corp.length > 0) {
    return buildOnboardingDisplayRows(corporateEntities, directorKycStatus, directorAmlJson, sent);
  }

  return buildKycOnlyFallbackRows(directorKycStatus, directorAmlJson, sent);
}

/** True when director/shareholder list is built from CTOS company JSON + party supplements only. */
export function isDirectorShareholderListCtosMode(organizationCtosCompanyJson: unknown | null | undefined): boolean {
  return hasUsableCtosDirectorList(organizationCtosCompanyJson);
}
