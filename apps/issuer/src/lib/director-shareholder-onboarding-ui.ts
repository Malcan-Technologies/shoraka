import {
  filterVisiblePeopleRows,
  getCtosPartySupplementPipelineStatus,
  getCtosPartySupplementRequestId,
  getDirectorKycPartyRecord,
  isReadyOnboardingStatus as isReadyOnboardingStatusShared,
  normalizeRawStatus,
  normalizeDirectorShareholderIdKey,
  type ApplicationPersonRow,
} from "@cashsouk/types";

export function getSupplementPipelineStatus(onboarding: Record<string, unknown>): string {
  return getCtosPartySupplementPipelineStatus(onboarding);
}

export function getSupplementRequestId(onboarding: Record<string, unknown>): string {
  return getCtosPartySupplementRequestId(onboarding);
}

/**
 * SECTION: Director/shareholder onboarding status helpers
 * WHY: Use onboarding.status only for banner + proceed checks
 * INPUT: Person row onboarding status
 * OUTPUT: True when status is submission-ready
 * WHERE USED: Issuer banner, proceed gating, profile checks
 */
export function isReadyOnboardingStatus(statusRaw: unknown): boolean {
  return isReadyOnboardingStatusShared(String(statusRaw ?? ""));
}

/**
 * SECTION: Backward compatible readiness alias
 * WHY: Keep existing component calls stable while using shared readiness logic
 * INPUT: Raw onboarding status
 * OUTPUT: True when onboarding is submit-ready
 * WHERE USED: Legacy UI calls in director/shareholder section
 */
export function isRegTankSubmitReadyStatus(statusRaw: string): boolean {
  return isReadyOnboardingStatusShared(statusRaw);
}

export function hasStartedOnboarding(p: Pick<ApplicationPersonRow, "onboarding">): boolean {
  return Boolean(normalizeRawStatus(p.onboarding?.status));
}

/**
 * SECTION: Visible onboarding rows
 * WHY: Onboarding gating only applies to individual people
 * INPUT: Visible people list
 * OUTPUT: Individual-only people list
 * WHERE USED: Banner/proceed checks in issuer UI
 */
function getVisibleIndividualPeople(people: ApplicationPersonRow[]): ApplicationPersonRow[] {
  const visible = filterVisiblePeopleRows(people);
  return visible.filter((p) => p.entityType === "INDIVIDUAL");
}

export type CorporateEntitiesShape = {
  directors?: unknown[];
  shareholders?: unknown[];
  corporateShareholders?: unknown[];
};

function corpKeysFromRecord(rec: Record<string, unknown>): string[] {
  const raw =
    rec.businessNumber ??
    rec.registrationNumber ??
    rec.brn_ssm ??
    rec.ssmRegisterNumber ??
    rec.ssmRegistrationNumber ??
    rec.companyRegistrationNumber ??
    rec.additional_registration_no ??
    rec.ic_lcno ??
    rec.nic_brno ??
    "";
  const n = normalizeDirectorShareholderIdKey(String(raw));
  return n ? [n] : [];
}

/** Party exists on company corporate_entities.corporateShareholders (KYB path). */
export function hasCorporateShareholderEntity(
  matchKey: string,
  corporateShareholders: unknown
): boolean {
  return getCorporateShareholderEntityRecord(matchKey, corporateShareholders) != null;
}

export function getCorporateShareholderEntityRecord(
  matchKey: string,
  corporateShareholders: unknown
): Record<string, unknown> | null {
  const want = normalizeDirectorShareholderIdKey(matchKey);
  if (!want) return null;
  if (!Array.isArray(corporateShareholders)) return null;
  for (const row of corporateShareholders) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    for (const k of corpKeysFromRecord(rec)) {
      if (k === want) return rec;
    }
  }
  return null;
}

/** TYPE A: already on company KYC/KYB records (legacy lists). */
export function isPartyTypeA(
  p: ApplicationPersonRow,
  directorKycStatus: unknown,
  corporateEntities: CorporateEntitiesShape | null | undefined
): boolean {
  if (p.entityType === "CORPORATE") {
    return hasCorporateShareholderEntity(p.matchKey, corporateEntities?.corporateShareholders);
  }
  return getDirectorKycPartyRecord(p.matchKey, directorKycStatus) != null;
}

export function getSupplementOnboardingJson(
  partyKeyRaw: string,
  ctosPartySupplements: ReadonlyArray<{ partyKey: string; onboardingJson?: unknown }> | null | undefined
): Record<string, unknown> {
  const pk = normalizeDirectorShareholderIdKey(partyKeyRaw);
  if (!pk || !ctosPartySupplements?.length) return {};
  for (const row of ctosPartySupplements) {
    const k = normalizeDirectorShareholderIdKey(row.partyKey);
    if (k !== pk) continue;
    if (row.onboardingJson && typeof row.onboardingJson === "object" && !Array.isArray(row.onboardingJson)) {
      return row.onboardingJson as Record<string, unknown>;
    }
    return {};
  }
  return {};
}

/** True when every visible CTOS party row has onboarding submitted/ready status. */
export function areDirectorShareholdersReadyForApplicationSubmit(params: {
  people: ApplicationPersonRow[];
  directorKycStatus?: unknown;
  corporateEntities?: CorporateEntitiesShape | null | undefined;
  ctosPartySupplements?: ReadonlyArray<{ partyKey: string; onboardingJson?: unknown }> | null | undefined;
}): boolean {
  void params.directorKycStatus;
  void params.corporateEntities;
  void params.ctosPartySupplements;
  const visible = getVisibleIndividualPeople(params.people);
  if (visible.length === 0) return true;
  return visible.every((p) => isReadyOnboardingStatus(p.onboarding?.status));
}

export function personNeedsProfileDirectorAction(
  p: ApplicationPersonRow,
  directorKycStatus: unknown,
  corporateEntities: CorporateEntitiesShape | null | undefined,
  ctosPartySupplements: ReadonlyArray<{ partyKey: string; onboardingJson?: unknown }> | null | undefined
): boolean {
  if (p.entityType !== "INDIVIDUAL") return false;
  if (isPartyTypeA(p, directorKycStatus, corporateEntities)) return false;
  void ctosPartySupplements;
  return !isReadyOnboardingStatus(p.onboarding?.status);
}
