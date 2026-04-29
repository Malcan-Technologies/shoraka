/**
 * SECTION: Type A party detection (legacy company KYC / corporate KYB)
 * WHY: Issuer email and admin Notify must treat these parties as not needing CTOS onboarding email
 * INPUT: matchKey + director_kyc_status root + corporate_entities.corporateShareholders
 * OUTPUT: true when party is Type A (legacy list or corporate shareholder entity)
 * WHERE USED: Issuer director-shareholder UI, admin Notify column
 */

import { getDirectorKycPartyRecord, normalizeDirectorShareholderIdKey } from "./director-shareholder-display";

export type CorporateEntitiesShape = {
  directors?: unknown[];
  shareholders?: unknown[];
  corporateShareholders?: unknown[];
};

export type PartyTypeARowInput = {
  matchKey: string;
  entityType: "INDIVIDUAL" | "CORPORATE";
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

export function hasCorporateShareholderEntity(matchKey: string, corporateShareholders: unknown): boolean {
  return getCorporateShareholderEntityRecord(matchKey, corporateShareholders) != null;
}

/** TYPE A: already on company KYC/KYB records (legacy lists). */
export function isPartyTypeA(
  p: PartyTypeARowInput,
  directorKycStatus: unknown,
  corporateEntities: CorporateEntitiesShape | null | undefined
): boolean {
  if (p.entityType === "CORPORATE") {
    return hasCorporateShareholderEntity(p.matchKey, corporateEntities?.corporateShareholders);
  }
  return getDirectorKycPartyRecord(p.matchKey, directorKycStatus) != null;
}
