/**
 * SECTION: Issuer director/shareholder “new person after CTOS” diff
 * WHY: Same rules for in-app toast (admin) and notification send (API) after org CTOS refresh
 * INPUT: Visible individual rows before/after + issuer KYC/AML JSON + CTOS party supplements
 * OUTPUT: New individuals needing onboarding attention, or boolean gate for notify/toast
 * WHERE USED: apps/api notification hook; apps/admin Financial CTOS success toast
 */

import type { ApplicationPersonRow } from "./application-people-display";
import { filterVisiblePeopleRows } from "./application-people-display";
import { normalizeDirectorShareholderIdKey } from "./director-shareholder-display";
import { normalizeRawStatus } from "./status-normalization";

function hasStartedOnboarding(p: Pick<ApplicationPersonRow, "onboarding">): boolean {
  return Boolean(normalizeRawStatus(p.onboarding?.status));
}

function visibleIndividualPeople(
  people?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null
): ApplicationPersonRow[] {
  const list = (people ?? []).filter((p): p is ApplicationPersonRow => p != null);
  return filterVisiblePeopleRows(list).filter((p) => p.entityType === "INDIVIDUAL");
}

/**
 * Keys already represented in issuer director KYC / AML JSON or CTOS party supplements.
 * Mirrors apps/api `director-shareholder-notifications` so toast and notification stay aligned.
 */
export function buildIssuerDirectorShareholderKnownKeysFromIssuerDbAndSupplements(params: {
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  ctosPartySupplements: ReadonlyArray<{ party_key?: string | null; partyKey?: string | null }> | null | undefined;
}): { dbKeys: Set<string>; supplementKeys: Set<string> } {
  const dbKeys = new Set<string>();
  const supplementKeys = new Set<string>();

  const kycRoot =
    params.issuerDirectorKycStatus &&
    typeof params.issuerDirectorKycStatus === "object" &&
    !Array.isArray(params.issuerDirectorKycStatus)
      ? (params.issuerDirectorKycStatus as { directors?: unknown[]; individualShareholders?: unknown[] })
      : {};
  const kycRows = [
    ...(Array.isArray(kycRoot.directors) ? kycRoot.directors : []),
    ...(Array.isArray(kycRoot.individualShareholders) ? kycRoot.individualShareholders : []),
  ];
  for (const row of kycRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const key = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? r.ic_lcno ?? ""));
    if (key) dbKeys.add(key);
  }

  const amlRoot =
    params.issuerDirectorAmlStatus &&
    typeof params.issuerDirectorAmlStatus === "object" &&
    !Array.isArray(params.issuerDirectorAmlStatus)
      ? (params.issuerDirectorAmlStatus as {
          directors?: unknown[];
          individualShareholders?: unknown[];
          businessShareholders?: unknown[];
        })
      : {};
  const amlRows = [
    ...(Array.isArray(amlRoot.directors) ? amlRoot.directors : []),
    ...(Array.isArray(amlRoot.individualShareholders) ? amlRoot.individualShareholders : []),
  ];
  for (const row of amlRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const key = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? r.ic_lcno ?? ""));
    if (key) dbKeys.add(key);
  }
  const businessRows = Array.isArray(amlRoot.businessShareholders) ? amlRoot.businessShareholders : [];
  for (const row of businessRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const key = normalizeDirectorShareholderIdKey(
      String(
        r.businessNumber ??
          r.registrationNumber ??
          r.brn_ssm ??
          r.ic_lcno ??
          r.additional_registration_no ??
          ""
      )
    );
    if (key) dbKeys.add(key);
  }

  for (const s of params.ctosPartySupplements ?? []) {
    const raw = String(s.party_key ?? s.partyKey ?? "");
    const key = normalizeDirectorShareholderIdKey(raw);
    if (key) supplementKeys.add(key);
  }

  return { dbKeys, supplementKeys };
}

/**
 * Individuals in `after` who were not in `before`, are not already in issuer DB/supplements,
 * and have not started onboarding — same filter as `runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert`.
 */
export function computeNewIssuerDirectorShareholderIndividualsAfterCtosVisibleDiff(params: {
  beforeVisibleIndividuals: readonly ApplicationPersonRow[];
  afterVisibleIndividuals: readonly ApplicationPersonRow[];
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  ctosPartySupplements: ReadonlyArray<{ party_key?: string | null; partyKey?: string | null }> | null | undefined;
}): ApplicationPersonRow[] {
  const beforeKeys = new Set(params.beforeVisibleIndividuals.map((p) => p.matchKey));
  const { dbKeys, supplementKeys } = buildIssuerDirectorShareholderKnownKeysFromIssuerDbAndSupplements({
    issuerDirectorKycStatus: params.issuerDirectorKycStatus,
    issuerDirectorAmlStatus: params.issuerDirectorAmlStatus,
    ctosPartySupplements: params.ctosPartySupplements,
  });
  return params.afterVisibleIndividuals.filter((p) => {
    const key = normalizeDirectorShareholderIdKey(p.matchKey);
    if (!key) return false;
    if (beforeKeys.has(key)) return false;
    if (dbKeys.has(key)) return false;
    if (supplementKeys.has(key)) return false;
    return !hasStartedOnboarding(p);
  });
}

/** True when at least one such new individual exists (notification + admin toast gate). */
export function shouldNotifyIssuerDirectorShareholderAfterOrgCtosFromResolvedPeopleSnapshots(params: {
  beforePeople?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null;
  afterPeople?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null;
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  ctosPartySupplements: ReadonlyArray<{ party_key?: string | null; partyKey?: string | null }> | null | undefined;
}): boolean {
  const beforeVisible = visibleIndividualPeople(params.beforePeople);
  const afterVisible = visibleIndividualPeople(params.afterPeople);
  if (afterVisible.length === 0) return false;
  const newPeople = computeNewIssuerDirectorShareholderIndividualsAfterCtosVisibleDiff({
    beforeVisibleIndividuals: beforeVisible,
    afterVisibleIndividuals: afterVisible,
    issuerDirectorKycStatus: params.issuerDirectorKycStatus,
    issuerDirectorAmlStatus: params.issuerDirectorAmlStatus,
    ctosPartySupplements: params.ctosPartySupplements,
  });
  return newPeople.length > 0;
}
