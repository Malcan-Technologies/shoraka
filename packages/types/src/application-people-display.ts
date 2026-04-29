/**
 * SECTION: application.people[] display helpers
 * WHY: Same role/share rules for admin, issuer, and investor listings
 * INPUT: rows from API `people` (roles[], sharePercentage)
 * OUTPUT: filtered rows + role line + share % cell text
 * WHERE USED: Admin application/org review, issuer/investor profile, company step
 */

import { getCtosPartySupplementFlatRead } from "./ctos-party-supplement-json";
import {
  getDirectorShareholderDisplayRows,
  normalizeDirectorShareholderIdKey,
  type DirectorShareholderDisplayRow,
  type GetDirectorShareholderDisplayRowsInput,
} from "./director-shareholder-display";

export type ApplicationPersonRow = {
  matchKey: string;
  name: string | null;
  entityType: "INDIVIDUAL" | "CORPORATE";
  roles: string[];
  sharePercentage: number | null;
  status: string;
  action?: "SEND_EMAIL" | null;
};

export type PeopleRolesRowInput = {
  roles: string[];
  sharePercentage: number | null;
};

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

const EM_DASH = "\u2014";

export function formatSharePercentageCell(p: { sharePercentage: number | null }): string {
  const v = p.sharePercentage;
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) {
    return EM_DASH;
  }
  if (typeof v === "number") {
    return Number.isInteger(v) ? `${v}%` : `${Number(v.toFixed(2))}%`;
  }
  return EM_DASH;
}

export function shouldShowPeopleSendEmailButton(
  p: Pick<ApplicationPersonRow, "entityType" | "status">,
  portal: "issuer" | "investor" | "admin"
): boolean {
  if (portal !== "issuer") return false;
  if (p.entityType !== "INDIVIDUAL") return false;
  const s = String(p.status ?? "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ");
  return s === "NEW REQUIRED";
}

export function isFinancialReviewKycReadyForApprove(params: {
  people?: ApplicationPersonRow[] | null | undefined;
  ctosPartySupplements?: { party_key?: string; onboarding_json?: unknown }[] | null | undefined;
}): boolean {
  const issuerOrgSupplements = params.ctosPartySupplements;
  if (!issuerOrgSupplements || !Array.isArray(issuerOrgSupplements)) return true;

  const onboardingByPartyKey = new Map<string, Record<string, unknown>>();
  const supplementPartyKeys = new Set<string>();

  for (const supplement of issuerOrgSupplements) {
    const key = normalizeDirectorShareholderIdKey(supplement.party_key ?? "");
    if (!key) continue;
    supplementPartyKeys.add(key);
    const onboarding =
      supplement.onboarding_json &&
      typeof supplement.onboarding_json === "object" &&
      !Array.isArray(supplement.onboarding_json)
        ? (supplement.onboarding_json as Record<string, unknown>)
        : {};
    onboardingByPartyKey.set(key, onboarding);
  }

  const visible = filterVisiblePeopleRows(params.people ?? []);

  for (const p of visible) {
    if (p.entityType !== "INDIVIDUAL") continue;
    const partyKey = normalizeDirectorShareholderIdKey(p.matchKey?.trim() ?? "");
    if (!partyKey) continue;
    const st = String(p.status ?? "")
      .trim()
      .toUpperCase()
      .replace(/_/g, " ");
    if (st === "APPROVED") continue;
    if (!supplementPartyKeys.has(partyKey)) continue;
    const raw = onboardingByPartyKey.get(partyKey) ?? {};
    const flat = getCtosPartySupplementFlatRead(raw);
    const regtankStatus = String(flat.regtankStatus ?? "").trim().toUpperCase();
    const kycRawStatus =
      flat.kycBlock && typeof flat.kycBlock.rawStatus === "string"
        ? String(flat.kycBlock.rawStatus).trim().toUpperCase()
        : "";
    const approved = regtankStatus === "APPROVED" || kycRawStatus === "APPROVED";
    if (!approved) return false;
  }
  return true;
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
    (r.status && r.status !== "Not Started" ? 2 : 0) +
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
      return {
        id: p.matchKey,
        name: p.name ?? "",
        role,
        type: p.entityType === "CORPORATE" ? "COMPANY" : "INDIVIDUAL",
        idNumber: p.entityType === "INDIVIDUAL" ? p.matchKey : null,
        registrationNumber: p.entityType === "CORPORATE" ? p.matchKey : null,
        ownershipDisplay,
        email: "",
        status: "Not Started",
        canEnterEmail: false,
        canSendOnboarding: false,
        enquiryId: null,
        subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
        isDirector,
        isShareholder,
        sharePercentage: sharePct,
      };
    }
    return {
      ...base,
      id: p.matchKey,
      name: p.name?.trim() ? (p.name as string) : base.name,
      role,
      ownershipDisplay: ownershipDisplay ?? base.ownershipDisplay,
      isDirector,
      isShareholder,
      sharePercentage: sharePct,
    };
  });
}
