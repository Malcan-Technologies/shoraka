/**
 * SECTION: application.people[] display helpers
 * WHY: Same role/share rules for admin, issuer, and investor listings
 * INPUT: rows from API `people` (roles[], sharePercentage)
 * OUTPUT: filtered rows + role line + share % cell text
 * WHERE USED: Admin application/org review, issuer/investor profile, company step
 */

import {
  getDirectorShareholderDisplayRows,
  isCtosIndividualKycEligibleRow,
  normalizeDirectorShareholderIdKey,
  type DirectorShareholderDisplayRow,
  type GetDirectorShareholderDisplayRowsInput,
} from "./director-shareholder-display";
import { getCtosPartySupplementFlatRead } from "./ctos-party-supplement-json";
import { normalizeRawStatus } from "./status-normalization";
export type ApplicationPersonRow = {
  /**
   * SOURCE OF TRUTH (CRITICAL)
   *
   * - Director/Shareholder UI reads **`people` only** for row-level onboarding, screening, email, and `requestId`.
   * - Backend chooses **supplement-only** vs **issuer-only** per `matchKey` (`build-people-list.ts`); the UI must not merge raw JSON or issuer blobs into these fields.
   */
  matchKey: string;
  name: string | null;
  entityType: "INDIVIDUAL" | "CORPORATE";
  roles: string[];
  sharePercentage: number | null;
  /**
   * Resolved contact email: user-saved (supplement) → KYC → AML (see {@link ApplicationPersonRow.userEmail}…).
   * Built server-side in `buildAdminPeopleList`.
   */
  email?: string;
  /** Email saved in `ctos_party_supplements.onboarding_json` for this party (user input). */
  userEmail?: string | null;
  /** Email from issuer `director_kyc_status` row matched by `matchKey` / government ID. */
  kycEmail?: string | null;
  /** Email from issuer `director_aml_status` row matched by IC, kycId, or name. */
  amlEmail?: string | null;
  /** Legacy display / gap label; prefer {@link ApplicationPersonRow.screening} for AML gating. */
  status: string;
  /** Optional per-person AML fallback label (e.g. from director_aml_status). */
  directorAmlStatus?: string | null;
  /** Optional per-person KYC fallback (e.g. from director_kyc_status). */
  directorKycStatus?: string | null;
  /**
   * Onboarding snapshot: from `ctos_party_supplements` when a row exists for this `matchKey`, else from issuer KYC/KYB JSON.
   * `id` is reference id (supplement) or KYC/KYB id (issuer). `verifyLink` / `updatedAt` are supplement-only when present.
   */
  onboarding?: {
    status?: string | null;
    id?: string | null;
    verifyLink?: string | null;
    updatedAt?: string | null;
  } | null;
  action?: "SEND_EMAIL" | null;
  /**
   * AML screening snapshot (e.g. RegTank ACURIS). When non-empty after normalization it wins over onboarding for the unified badge (`getFinalStatusLabel`).
   * `id` is AML/COD-linked request id when present.
   */
  screening?: {
    status?: string | null;
    id?: string | null;
    riskLevel?: string | null;
    riskScore?: string | number | null;
  } | null;
  /**
   * Best RegTank id for links: with supplement, `screening.requestId` then top-level onboarding `requestId`; else issuer KYC/KYB then EOD/COD.
   */
  requestId?: string | null;
  /** Set when row is built from `ctos_party_supplements`: which id won for {@link ApplicationPersonRow.requestId}. */
  requestIdType?: "SCREENING" | "ONBOARDING" | null;
  /** IC front image URL from issuer `corporate_entities` (director/shareholder `documents`). */
  icFrontUrl?: string | null;
  /** IC back image URL from issuer `corporate_entities` (director/shareholder `documents`). */
  icBackUrl?: string | null;
};

/**
 * RegTank onboarding-proxy origin (no trailing slash). File downloads / legacy proxy paths.
 */
export function getRegtankOnboardingProxyBaseUrl(): string {
  const fromEnv =
    typeof process !== "undefined" && typeof process.env.NEXT_PUBLIC_REGTANK_ONBOARDING_PROXY_URL === "string"
      ? process.env.NEXT_PUBLIC_REGTANK_ONBOARDING_PROXY_URL.trim()
      : "";
  const raw = fromEnv || "https://shoraka-trial-onboarding-proxy.regtank.com";
  return raw.replace(/\/+$/, "");
}

/**
 * RegTank **client** portal origin (no trailing slash), same as API `adminPortalUrl` / admin `NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL`.
 */
export function getRegtankClientPortalBaseUrl(): string {
  const fromEnv =
    typeof process !== "undefined" && typeof process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL === "string"
      ? process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL.trim()
      : "";
  const raw = fromEnv || "https://shoraka-trial.regtank.com";
  return raw.replace(/\/+$/, "");
}

function kybScreeningHasRisk(screening: ApplicationPersonRow["screening"]): boolean {
  const rl = String(screening?.riskLevel ?? "").trim();
  if (rl) return true;
  const rs = screening?.riskScore;
  if (rs == null) return false;
  const s = String(rs).trim();
  return s.length > 0;
}

/**
 * Deep link into RegTank **client** portal for this row’s primary `requestId` (admin opens in new tab).
 * Mirrors `buildRegTankPortalUrl` (API) and onboarding application `regtankPortalUrl` / KYC-KYB paths.
 */
export function getRegtankLink(
  person: Pick<ApplicationPersonRow, "requestId" | "entityType" | "screening">
): string | null {
  const id = String(person.requestId ?? "").trim();
  if (!id) return null;
  const base = getRegtankClientPortalBaseUrl();
  const enc = encodeURIComponent(id);

  if (id.startsWith("KYC")) {
    return `${base}/app/screen-kyc/result/${enc}/scoring`;
  }
  if (id.startsWith("KYB")) {
    const suffix = kybScreeningHasRisk(person.screening) ? "/riskAssessment" : "";
    return `${base}/app/screen-kyb/result/${enc}${suffix}`;
  }
  if (id.startsWith("COD")) {
    return `${base}/app/onboardingCorporate/${enc}?archived=false`;
  }
  if (id.startsWith("LD") || id.startsWith("EOD")) {
    return `${base}/app/liveness/${enc}?archived=false`;
  }
  return null;
}

export type DisplayStatusPerson = {
  screening?: { status?: string | null; riskLevel?: string | null; riskScore?: string | number | null } | null;
  directorAmlStatus?: string | null;
  directorKycStatus?: string | null;
  onboarding?: { status?: string | null; id?: string | null } | null;
};

export type PeopleRolesRowInput = {
  roles: string[];
  sharePercentage: number | null;
};

/** Normalize party email for duplicate checks (trim + lowercase). */
export function normalizeDirectorShareholderPartyEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

export function filterVisiblePeopleRows<T extends PeopleRolesRowInput>(peopleRows: T[]): T[] {
  return peopleRows
    .map((p) => {
      const roles = Array.isArray(p.roles) ? p.roles : [];
      const hasDirector = roles.includes("DIRECTOR");
      const hasShareholder = roles.includes("SHAREHOLDER");
      const sharePct = p.sharePercentage;
      const shareholderAllowed =
        !hasShareholder || sharePct === null || typeof sharePct !== "number" || sharePct >= 5;

      const nextRoles = roles.filter((role) => {
        if (role === "DIRECTOR") return true;
        if (role === "SHAREHOLDER") return shareholderAllowed;
        return true;
      });

      if (!hasDirector && hasShareholder && !shareholderAllowed) return null;
      if (nextRoles.length === 0) return null;

      return { ...p, roles: nextRoles };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

export function formatPeopleRolesLine(p: PeopleRolesRowInput): string {
  const upper = p.roles.map((r) => r.toUpperCase());
  const hasDirector = upper.includes("DIRECTOR");
  const hasShareholder = upper.includes("SHAREHOLDER");
  const pctRaw = p.sharePercentage;
  const pctLabel =
    typeof pctRaw === "number" && Number.isFinite(pctRaw)
      ? `${Number.isInteger(pctRaw) ? pctRaw : Number(pctRaw.toFixed(2))}%`
      : null;

  if (hasDirector && hasShareholder) {
    return pctLabel ? `DIRECTOR, SHAREHOLDER (${pctLabel})` : "DIRECTOR, SHAREHOLDER";
  }
  if (hasShareholder && !hasDirector) {
    return pctLabel ? `SHAREHOLDER (${pctLabel})` : "SHAREHOLDER";
  }
  if (hasDirector) {
    return "DIRECTOR";
  }
  return upper.join(", ");
}

/** Role labels only (no ownership %); use when share % is shown in its own column. */
export function formatPeopleRolesLineWithoutShare(p: PeopleRolesRowInput): string {
  const upper = p.roles.map((r) => r.toUpperCase());
  const hasDirector = upper.includes("DIRECTOR");
  const hasShareholder = upper.includes("SHAREHOLDER");
  if (hasDirector && hasShareholder) return "DIRECTOR, SHAREHOLDER";
  if (hasShareholder && !hasDirector) return "SHAREHOLDER";
  if (hasDirector) return "DIRECTOR";
  return upper.join(", ");
}

/**
 * Same as {@link formatPeopleRolesLine} with admin-style title case (Director, Shareholder).
 * WHERE USED: Issuer/investor profile director-shareholder cards (parity with admin table wording).
 */
export function formatPeopleRolesLineTitleCase(p: PeopleRolesRowInput): string {
  const line = formatPeopleRolesLine(p);
  return line.replace(/\bDIRECTOR\b/g, "Director").replace(/\bSHAREHOLDER\b/g, "Shareholder");
}

/**
 * {@link formatPeopleRolesLineWithoutShare} in title case (Director, Shareholder).
 * WHERE USED: Issuer application company-details when share % is shown in a separate column.
 */
export function formatPeopleRolesLineTitleCaseWithoutShare(p: PeopleRolesRowInput): string {
  const line = formatPeopleRolesLineWithoutShare(p);
  return line.replace(/\bDIRECTOR\b/g, "Director").replace(/\bSHAREHOLDER\b/g, "Shareholder");
}

/**
 * Second-line identity for cards: `IC {matchKey}` or `SSM {matchKey}` (admin shows `matchKey` under name).
 * WHERE USED: Issuer/investor profile cards so IC and SSM sit in the same slot as each other and as email.
 */
export function formatPeopleIdentityLine(person: Pick<ApplicationPersonRow, "entityType" | "matchKey">): string | null {
  const k = String(person.matchKey ?? "").trim();
  if (!k) return null;
  if (person.entityType === "CORPORATE") return `SSM ${k}`;
  return `IC ${k}`;
}

function firstUsableStatus(raw: unknown): string | null {
  const s = normalizeRawStatus(raw);
  if (!s) return null;
  return s;
}

/**
 * SECTION: Unified director/shareholder display status priority
 * WHY: Keep one shared status order across portals and pages
 * INPUT: person-level screening + legacy AML/KYC + onboarding progress status
 * OUTPUT: highest-priority available status string, or empty string when empty
 * WHERE USED: admin/issuer/investor director-shareholder views
 */
export function getDisplayStatus(person: DisplayStatusPerson): string {
  return (
    firstUsableStatus(person.screening?.status) ??
    firstUsableStatus(person.directorAmlStatus) ??
    firstUsableStatus(person.directorKycStatus) ??
    firstUsableStatus(person.onboarding?.status) ??
    ""
  );
}

export function formatSharePercentageCell(p: { sharePercentage: number | null }): string {
  const v = p.sharePercentage;
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) {
    return "";
  }
  if (typeof v === "number") {
    return Number.isInteger(v) ? `${v}%` : `${Number(v.toFixed(2))}%`;
  }
  return "";
}

/** Share cell with ownership label, e.g. `50% ownership`. Empty when no numeric share. */
export function formatShareOwnershipCell(p: { sharePercentage: number | null }): string {
  const pct = formatSharePercentageCell(p);
  if (!pct) return "";
  return `${pct} ownership`;
}

/**
 * SECTION: Director/shareholder onboarding-email role gate
 * WHY: Individual director or ≥5% shareholder may receive CTOS party onboarding email
 * INPUT: A single people row
 * OUTPUT: True when role/share rules allow onboarding email for this party
 * WHERE USED: {@link canManageDirectorShareholder}
 */
export function requiresOnboardingEmail(p: ApplicationPersonRow): boolean {
  if (p.entityType !== "INDIVIDUAL") return false;
  const roles = (p.roles ?? []).map((r) => String(r).toUpperCase());
  const isDirector = roles.includes("DIRECTOR");
  const isShareholder = roles.includes("SHAREHOLDER");
  const share = Number(p.sharePercentage ?? 0);
  return isDirector || (isShareholder && share >= 5);
}

/** AML terminal: no resend/notify/email edit while cleared or hard-rejected. */
const AML_STATUSES_BLOCK_MANAGE = new Set([
  "REJECTED",
  "FAILED",
  "DECLINED",
  "APPROVED",
  "AML_APPROVED",
  "CLEAR",
]);

/** Onboarding frozen after submit to RegTank review or fully done — issuer should not resend from here. */
const ONBOARDING_STATUSES_BLOCK_MANAGE = new Set(["WAIT_FOR_APPROVAL", "APPROVED"]);

/**
 * SECTION: Unified issuer + admin action gate (email edit, resend, notify, banner)
 * WHY: One rule: allow when onboarding is actionable (not WFA/APPROVED) and AML is not terminal (not cleared, not reject/fail/decline)
 * INPUT: A single people row
 * OUTPUT: True when the issuer (or admin notify) may edit email, resend onboarding, or send a reminder
 * WHERE USED: Issuer profile, admin table, API notify/resend guards, issuer banner (`hasActionableDirectorShareholder`)
 */
export function canManageDirectorShareholder(p: ApplicationPersonRow): boolean {
  if (!requiresOnboardingEmail(p)) return false;
  const onboarding = normalizeRawStatus(p.onboarding?.status);
  const screening = normalizeRawStatus(p.screening?.status);
  if (screening && AML_STATUSES_BLOCK_MANAGE.has(screening)) return false;
  if (ONBOARDING_STATUSES_BLOCK_MANAGE.has(onboarding)) return false;
  return true;
}

/**
 * True when any visible row can still receive issuer/admin actions (email, resend, notify).
 * Uses {@link filterVisiblePeopleRows} then {@link canManageDirectorShareholder}.
 */
export function hasActionableDirectorShareholder(
  people?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null
): boolean {
  const list = (people ?? []).filter((p): p is ApplicationPersonRow => p != null);
  const visible = filterVisiblePeopleRows(list);
  return visible.some((p) => canManageDirectorShareholder(p));
}

function getVisibleIndividualPeopleFromList(
  people?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null
): ApplicationPersonRow[] {
  const list = (people ?? []).filter((p): p is ApplicationPersonRow => p != null);
  return filterVisiblePeopleRows(list).filter((p) => p.entityType === "INDIVIDUAL");
}

/**
 * Issuer submit / resubmit: every visible individual must be at or past RegTank review submission.
 * AML does not affect this gate.
 */
export function isReadyForSubmit(
  people?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null
): boolean {
  const individuals = getVisibleIndividualPeopleFromList(people);
  if (individuals.length === 0) return true;
  return individuals.every((p) => {
    const onboarding = normalizeRawStatus(p.onboarding?.status);
    return onboarding === "WAIT_FOR_APPROVAL" || onboarding === "APPROVED";
  });
}

/**
 * Admin Financial section approve: every visible individual must have AML screening approved.
 * Onboarding stage does not affect this gate.
 */
export function isReadyForFinancialApproval(
  people?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null
): boolean {
  const individuals = getVisibleIndividualPeopleFromList(people);
  if (individuals.length === 0) return true;
  return individuals.every((p) => isDirectorShareholderAmlScreeningApproved(p));
}

/**
 * Build the display row used for {@link isCtosIndividualKycEligibleRow} and lock checks
 * (same shape as issuer `personToDisplayRow`).
 */
export function buildDirectorShareholderDisplayRowForEmailEligibility(
  p: ApplicationPersonRow,
  supplementOnboarding: Record<string, unknown> | null | undefined
): DirectorShareholderDisplayRow {
  const sup =
    supplementOnboarding && typeof supplementOnboarding === "object" && !Array.isArray(supplementOnboarding)
      ? supplementOnboarding
      : {};
  const flat = getCtosPartySupplementFlatRead(sup);
  const regtankStatus = flat.regtankStatus;
  const kycBlock = flat.kycBlock;
  const kycRawStatus = kycBlock ? String(kycBlock.rawStatus ?? "").trim() || null : null;
  const status = getDisplayStatus({
    screening: p.screening,
    directorAmlStatus: p.directorAmlStatus ?? null,
    directorKycStatus: p.directorKycStatus ?? kycRawStatus,
    onboarding: { status: p.onboarding?.status ?? regtankStatus ?? null },
  });
  const rolesU = (p.roles ?? []).map((r) => r.toUpperCase());
  const isDirector = rolesU.includes("DIRECTOR");
  const isShareholder = rolesU.includes("SHAREHOLDER");
  const sharePct = p.sharePercentage;
  const ownershipDisplay =
    sharePct != null && Number.isFinite(sharePct) ? `${sharePct}% ownership` : null;
  const email = String(p.email ?? "").trim() || flat.email.trim();
  const draftEligible =
    p.entityType === "INDIVIDUAL" && (isDirector || (isShareholder && (sharePct ?? 0) >= 5));
  return {
    id: p.matchKey,
    name: p.name ?? "",
    role: formatPeopleRolesLine(p),
    type: p.entityType === "CORPORATE" ? "COMPANY" : "INDIVIDUAL",
    idNumber: p.entityType === "INDIVIDUAL" ? p.matchKey : null,
    registrationNumber: p.entityType === "CORPORATE" ? p.matchKey : null,
    ownershipDisplay,
    email,
    status,
    canEnterEmail: true,
    canSendOnboarding: true,
    enquiryId: null,
    subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
    ctosIndividualKycEligible: draftEligible,
    isDirector,
    isShareholder,
    sharePercentage: sharePct,
  };
}

export function shouldShowPeopleSendEmailButton(
  _p: Pick<ApplicationPersonRow, "entityType" | "status">,
  _portal: "issuer" | "investor" | "admin"
): boolean {
  return false;
}

/** True when AML value is approved for AML decision checks. */
function isAmlApprovedValue(raw: unknown): boolean {
  const compact = String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "_");
  return compact === "APPROVED" || compact === "AML_APPROVED" || compact === "CLEAR";
}

/** True when AML is cleared using priority: screening.status -> directorAmlStatus. */
export function isDirectorShareholderAmlScreeningApproved(
  source:
    | { status?: string | null }
    | { screening?: { status?: string | null } | null; directorAmlStatus?: string | null }
    | null
    | undefined
): boolean {
  const hasNestedScreening =
    !!source &&
    typeof source === "object" &&
    "screening" in source;
  const screeningStatus = hasNestedScreening
    ? (source as { screening?: { status?: string | null } | null }).screening?.status
    : (source as { status?: string | null } | null | undefined)?.status;
  if (isAmlApprovedValue(screeningStatus)) return true;
  if (hasNestedScreening) {
    const legacy = (source as { directorAmlStatus?: string | null }).directorAmlStatus;
    if (isAmlApprovedValue(legacy)) return true;
  }
  return false;
}

/**
 * True when director/shareholder AML is not fully cleared.
 * `null`, `undefined`, or empty `people` counts as pending (same as no parties / no data yet).
 */
export function peopleHasPendingDirectorShareholderAml(
  people?: ReadonlyArray<
    Pick<ApplicationPersonRow, "screening" | "directorAmlStatus" | "status"> | null | undefined
  > | null
): boolean {
  if (!people || people.length === 0) return true;
  return people.some((p) => !isDirectorShareholderAmlScreeningApproved(p));
}

export function isFinancialReviewKycReadyForApprove(params: {
  people?: ApplicationPersonRow[] | null | undefined;
  ctosPartySupplements?: { party_key?: string; onboarding_json?: unknown }[] | null | undefined;
}): boolean {
  void params.ctosPartySupplements;
  const visible = filterVisiblePeopleRows(params.people ?? []);
  return !peopleHasPendingDirectorShareholderAml(visible);
}

function legacyRowMatchNormKeys(row: DirectorShareholderDisplayRow): string[] {
  const keys = new Set<string>();
  const add = (s: string | null | undefined) => {
    const n = normalizeDirectorShareholderIdKey(String(s ?? ""));
    if (n) keys.add(n);
  };
  add(row.idNumber);
  add(row.registrationNumber);
  add(row.enquiryId);
  const id = String(row.id ?? "");
  if (id.startsWith("ctos-")) add(id.slice("ctos-".length));
  if (id.startsWith("onb-ind-")) add(id.replace(/^onb-ind-/, ""));
  if (id.startsWith("onb-corp-")) add(id.replace(/^onb-corp-/, ""));
  if (id.startsWith("kyc-only-")) add(id.replace(/^kyc-only-/, ""));
  return [...keys];
}

function pickLegacyRowForPerson(
  candidates: DirectorShareholderDisplayRow[],
  p: ApplicationPersonRow
): DirectorShareholderDisplayRow | null {
  if (candidates.length === 0) return null;
  const wantCompany = p.entityType === "CORPORATE";
  const typeMatch = candidates.filter((r) => (r.type === "COMPANY") === wantCompany);
  const pool = typeMatch.length > 0 ? typeMatch : candidates;
  const score = (r: DirectorShareholderDisplayRow) =>
    (r.amlStatus?.trim() ? 4 : 0) +
    (normalizeRawStatus(r.status) ? 2 : 0) +
    (r.email?.trim() ? 1 : 0);
  const sorted = [...pool].sort((a, b) => score(b) - score(a));
  return sorted[0] ?? null;
}

/**
 * One row per filtered `people` entry; KYC/AML/email merged from legacy unified rows by normalized ID.
 */
export function applicationPeopleToUnifiedDirectorRows(
  people: ApplicationPersonRow[],
  legacyInput: GetDirectorShareholderDisplayRowsInput
): DirectorShareholderDisplayRow[] {
  const legacyRows = getDirectorShareholderDisplayRows(legacyInput);
  const byNorm = new Map<string, DirectorShareholderDisplayRow[]>();
  for (const row of legacyRows) {
    for (const k of legacyRowMatchNormKeys(row)) {
      const list = byNorm.get(k) ?? [];
      list.push(row);
      byNorm.set(k, list);
    }
  }
  const visible = filterVisiblePeopleRows(people);
  return visible.map((p) => {
    const norm = normalizeDirectorShareholderIdKey(p.matchKey);
    const candidates = norm ? (byNorm.get(norm) ?? []) : [];
    const base = pickLegacyRowForPerson(candidates, p);
    const role = formatPeopleRolesLine(p);
    const sharePct = p.sharePercentage;
    const ownershipDisplay =
      sharePct != null && Number.isFinite(sharePct) ? `${sharePct}% ownership` : base?.ownershipDisplay ?? null;
    const rolesU = (p.roles ?? []).map((r) => r.toUpperCase());
    const isDirector = rolesU.includes("DIRECTOR");
    const isShareholder = rolesU.includes("SHAREHOLDER");
    if (!base) {
      const displayStatus = getDisplayStatus({
        screening: p.screening,
      });
      return {
        id: p.matchKey,
        name: p.name ?? "",
        role,
        type: p.entityType === "CORPORATE" ? "COMPANY" : "INDIVIDUAL",
        idNumber: p.entityType === "INDIVIDUAL" ? p.matchKey : null,
        registrationNumber: p.entityType === "CORPORATE" ? p.matchKey : null,
        ownershipDisplay,
        email: String(p.email ?? "").trim(),
        status: displayStatus,
        canEnterEmail: false,
        canSendOnboarding: false,
        enquiryId: null,
        subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
        isDirector,
        isShareholder,
        sharePercentage: sharePct,
      };
    }
    const displayStatus = getDisplayStatus({
      screening: p.screening,
      directorAmlStatus: base.amlStatus ?? null,
      directorKycStatus: base.status ?? null,
      onboarding: { status: base.ctosRegtankStatus ?? null },
    });
    const personEmail = String(p.email ?? "").trim();
    return {
      ...base,
      id: p.matchKey,
      name: p.name?.trim() ? (p.name as string) : base.name,
      role,
      ownershipDisplay: ownershipDisplay ?? base.ownershipDisplay,
      email: personEmail || String(base.email ?? "").trim(),
      status: displayStatus,
      isDirector,
      isShareholder,
      sharePercentage: sharePct,
    };
  });
}
