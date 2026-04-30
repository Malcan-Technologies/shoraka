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
import {
  getCtosPartySupplementFlatRead,
  isCtosPartySupplementApprovalLocked,
} from "./ctos-party-supplement-json";
import { isPartyTypeA, type CorporateEntitiesShape } from "./director-shareholder-party-type-a";
import { normalizeRawStatus } from "./status-normalization";

export type ApplicationPersonRow = {
  /**
   * SOURCE OF TRUTH (CRITICAL)
   *
   * - All Director/Shareholder UI must use `people` only
   * - Do NOT read:
   *   - CTOS supplement (onboarding_json)
   *   - director_kyc_status / director_aml_status
   * - Do NOT recompute:
   *   - onboarding status
   *   - screening status
   *   - email
   *
   * Backend is responsible for full enrichment.
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
  /** Optional onboarding pipeline snapshot from CTOS party supplement. */
  onboarding?: { status?: string | null } | null;
  action?: "SEND_EMAIL" | null;
  /** Flat AML screening snapshot (e.g. RegTank ACURIS `status`). Single source for submit/badge gating. */
  screening?: { status?: string | null } | null;
};

export type DisplayStatusPerson = {
  screening?: { status?: string | null } | null;
  directorAmlStatus?: string | null;
  directorKycStatus?: string | null;
  onboarding?: { status?: string | null } | null;
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
      if (nextRoles.length === 0) {
        const ent = "entityType" in p ? String((p as { entityType?: string }).entityType ?? "") : "";
        console.log("[PEOPLE FILTER DROP] empty roles after visibility rules", {
          entityType: ent || undefined,
          matchKey: "matchKey" in p ? String((p as { matchKey?: string }).matchKey ?? "") : undefined,
          rolesBefore: roles,
          sharePercentage: sharePct,
        });
        return null;
      }

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

/**
 * SECTION: Director/shareholder onboarding-email role gate
 * WHY: Individual director or ≥5% shareholder may receive CTOS party onboarding email
 * INPUT: A single people row
 * OUTPUT: True when role/share rules allow onboarding email for this party
 * WHERE USED: {@link isDirectorShareholderEmailActionable}, issuer and admin UIs
 */
export function requiresOnboardingEmail(p: ApplicationPersonRow): boolean {
  if (p.entityType !== "INDIVIDUAL") return false;
  const roles = (p.roles ?? []).map((r) => String(r).toUpperCase());
  const isDirector = roles.includes("DIRECTOR");
  const isShareholder = roles.includes("SHAREHOLDER");
  const share = Number(p.sharePercentage ?? 0);
  return isDirector || (isShareholder && share >= 5);
}

/**
 * SECTION: Director/shareholder completion gate for email/notify
 * WHY: Email entry and admin notify must follow the same rule
 * INPUT: A single people row
 * OUTPUT: True when person is completed and should not be actioned
 * WHERE USED: issuer email entry + admin notify visibility
 */
export function isDirectorShareholderCompleted(p: ApplicationPersonRow): boolean {
  const onboarding = normalizeRawStatus(p.onboarding?.status);
  const screening = normalizeRawStatus(p.screening?.status);
  return onboarding === "APPROVED" || onboarding === "WAIT_FOR_APPROVAL" || screening === "APPROVED";
}

/**
 * SECTION: Unified action gate for issuer email and admin notify
 * WHY: Keep CTA behavior identical across portals
 * INPUT: A single people row
 * OUTPUT: True when user should be allowed to action this person
 * WHERE USED: issuer profile + admin director/shareholder table
 */
export function canEnterEmailForDirectorShareholder(p: ApplicationPersonRow): boolean {
  return p.entityType === "INDIVIDUAL" && !isDirectorShareholderCompleted(p);
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

export type DirectorShareholderEmailActionableContext = {
  displayRow: DirectorShareholderDisplayRow;
  latestOnboardingRoot: unknown;
  /** Issuer profile: true when TYPE A/B supplement path is active. */
  partySourcePresent: boolean;
  directorKycStatus: unknown;
  corporateEntities: CorporateEntitiesShape | null | undefined;
  /** Issuer: blocks when org id is set and onboarding is not COMPLETED. */
  blockPartyOnboarding: boolean;
};

function directorShareholderDisplayRowKycApproved(row: DirectorShareholderDisplayRow): boolean {
  return normalizeRawStatus(row.status) === "APPROVED";
}

/**
 * Single gate for issuer email controls and admin Notify: role rules, Type A, CTOS row eligibility,
 * org onboarding gate, and supplement / legacy KYC approval locks.
 */
export function isDirectorShareholderEmailActionable(
  person: ApplicationPersonRow,
  ctx: DirectorShareholderEmailActionableContext
): boolean {
  if (!requiresOnboardingEmail(person)) return false;
  if (ctx.partySourcePresent && isPartyTypeA(person, ctx.directorKycStatus, ctx.corporateEntities)) {
    return false;
  }
  if (!isCtosIndividualKycEligibleRow(ctx.displayRow)) return false;
  if (ctx.blockPartyOnboarding) return false;

  const supplementLocked = isCtosPartySupplementApprovalLocked(ctx.latestOnboardingRoot);
  if (ctx.partySourcePresent) {
    if (supplementLocked) return false;
  } else if (directorShareholderDisplayRowKycApproved(ctx.displayRow) || supplementLocked) {
    return false;
  }
  return true;
}

/** Backward-compatible alias for existing call sites. */
export function isNotifyEligible(p: ApplicationPersonRow): boolean {
  return canEnterEmailForDirectorShareholder(p);
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
  return compact === "APPROVED";
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
