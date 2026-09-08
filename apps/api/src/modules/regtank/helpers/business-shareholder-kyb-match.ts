import { getCorporateShareholderCodId } from "./corporate-shareholder-status-sync";

export type BusinessShareholderKybIds = {
  kybId?: string | null;
  onboardingId?: string | null;
};

export type BusinessShareholderKybMatch = {
  corporateShareholder: Record<string, unknown> | null;
  amlEntry: Record<string, unknown> | null;
  shareholderCodRequestId: string;
  storedKybId: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function trimId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getCorporateShareholderKybId(row: Record<string, unknown>): string {
  const dto = asRecord(row.kybRequestDto);
  if (dto) {
    const nested = trimId(dto.kybId);
    if (nested) return nested;
  }
  return trimId(row.kybId);
}

function listCorporateShareholders(corporateEntities: unknown): Record<string, unknown>[] {
  const root = asRecord(corporateEntities);
  const list = root?.corporateShareholders;
  if (!Array.isArray(list)) return [];
  return list.filter((row): row is Record<string, unknown> => asRecord(row) != null);
}

function listAmlBusinessShareholders(directorAmlStatus: unknown): Record<string, unknown>[] {
  const root = asRecord(directorAmlStatus);
  const list = root?.businessShareholders;
  if (!Array.isArray(list)) return [];
  return list.filter((row): row is Record<string, unknown> => asRecord(row) != null);
}

function collectFormFieldValue(formContent: unknown, fieldName: string): string | null {
  const want = fieldName.trim().toLowerCase();
  const visit = (node: unknown): string | null => {
    if (node == null) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = visit(item);
        if (hit) return hit;
      }
      return null;
    }
    const rec = asRecord(node);
    if (!rec) return null;
    if (typeof rec.fieldName === "string" && rec.fieldName.trim().toLowerCase() === want) {
      const val = trimId(rec.fieldValue);
      if (val) return val;
    }
    for (const child of Object.values(rec)) {
      const hit = visit(child);
      if (hit) return hit;
    }
    return null;
  };
  return visit(formContent);
}

export function extractBusinessNumberFromCorpShareholderRow(row: Record<string, unknown>): string | null {
  return collectFormFieldValue(row.formContent, "Business Number");
}

export function extractBusinessNameFromCorpShareholderRow(row: Record<string, unknown>): string | null {
  return (
    collectFormFieldValue(row.formContent, "Business Name") ||
    trimId(row.businessName) ||
    trimId(row.companyName) ||
    null
  );
}

/**
 * Nested corporate-shareholder KYB must match the shareholder row, not the parent COD.
 * Prefer kybId (CE or director_aml_status.businessShareholders) over webhook onboardingId,
 * because RegTank often sends the parent company COD as onboardingId for nested KYB.
 */
export function matchBusinessShareholderForKybWebhook(
  org: { corporate_entities: unknown; director_aml_status: unknown },
  ids: BusinessShareholderKybIds
): BusinessShareholderKybMatch | null {
  const kybId = trimId(ids.kybId);
  const onboardingId = trimId(ids.onboardingId);
  const ceRows = listCorporateShareholders(org.corporate_entities);
  const amlRows = listAmlBusinessShareholders(org.director_aml_status);

  if (kybId) {
    const ceByKyb = ceRows.find((row) => getCorporateShareholderKybId(row) === kybId) ?? null;
    const amlByKyb = amlRows.find((row) => trimId(row.kybId) === kybId) ?? null;
    if (ceByKyb || amlByKyb) {
      const shareholderCodRequestId =
        (ceByKyb ? getCorporateShareholderCodId(ceByKyb) : "") ||
        trimId(amlByKyb?.codRequestId);
      return {
        corporateShareholder: ceByKyb,
        amlEntry: amlByKyb,
        shareholderCodRequestId,
        storedKybId: kybId,
      };
    }
  }

  if (onboardingId) {
    const ceByCod = ceRows.find((row) => getCorporateShareholderCodId(row) === onboardingId) ?? null;
    const amlByCod = amlRows.find((row) => trimId(row.codRequestId) === onboardingId) ?? null;
    if (ceByCod || amlByCod) {
      const storedKybId =
        (ceByCod ? getCorporateShareholderKybId(ceByCod) : "") || trimId(amlByCod?.kybId);
      return {
        corporateShareholder: ceByCod,
        amlEntry: amlByCod,
        shareholderCodRequestId: onboardingId,
        storedKybId,
      };
    }
  }

  return null;
}
