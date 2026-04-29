import {
  filterVisiblePeopleRows,
  getCtosPartySupplementPipelineStatus,
  getCtosPartySupplementRequestId,
  getDirectorKycPartyRecord,
  normalizeDirectorShareholderIdKey,
  type ApplicationPersonRow,
} from "@cashsouk/types";

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

/** Pipeline status from CTOS party supplement JSON only (not AML). */
export function getSupplementPipelineStatus(onboarding: Record<string, unknown>): string {
  return getCtosPartySupplementPipelineStatus(onboarding);
}

export function getSupplementRequestId(onboarding: Record<string, unknown>): string {
  return getCtosPartySupplementRequestId(onboarding);
}

/**
 * Submission allowed for this party when RegTank is waiting for ops approval or already approved.
 * Blocks EMAIL_SENT, ID_UPLOADED, PENDING, etc.
 */
export function isRegTankSubmitReadyStatus(statusRaw: string): boolean {
  const u = statusRaw.toUpperCase().replace(/\s+/g, "_");
  if (!u) return false;
  if (u === "APPROVED") return true;
  if (u === "WAITING_FOR_APPROVAL" || u === "WAIT_FOR_APPROVAL" || u === "PENDING_APPROVAL") return true;
  return false;
}

export function areDirectorShareholdersReadyForApplicationSubmit(params: {
  people: ApplicationPersonRow[];
  directorKycStatus: unknown;
  corporateEntities: CorporateEntitiesShape | null | undefined;
  ctosPartySupplements: ReadonlyArray<{ partyKey: string; onboardingJson?: unknown }> | null | undefined;
}): boolean {
  const visible = filterVisiblePeopleRows(params.people);
  for (const p of visible) {
    if (isPartyTypeA(p, params.directorKycStatus, params.corporateEntities)) continue;
    const ob = getSupplementOnboardingJson(p.matchKey, params.ctosPartySupplements);
    if (!getSupplementRequestId(ob)) return false;
    if (!isRegTankSubmitReadyStatus(getSupplementPipelineStatus(ob))) return false;
  }
  return true;
}

export function personNeedsProfileDirectorAction(
  p: ApplicationPersonRow,
  directorKycStatus: unknown,
  corporateEntities: CorporateEntitiesShape | null | undefined,
  ctosPartySupplements: ReadonlyArray<{ partyKey: string; onboardingJson?: unknown }> | null | undefined
): boolean {
  if (isPartyTypeA(p, directorKycStatus, corporateEntities)) return false;
  if (p.entityType !== "INDIVIDUAL") {
    const ob = getSupplementOnboardingJson(p.matchKey, ctosPartySupplements);
    return !isRegTankSubmitReadyStatus(getSupplementPipelineStatus(ob)) || !getSupplementRequestId(ob);
  }
  const ob = getSupplementOnboardingJson(p.matchKey, ctosPartySupplements);
  return !isRegTankSubmitReadyStatus(getSupplementPipelineStatus(ob)) || !getSupplementRequestId(ob);
}
