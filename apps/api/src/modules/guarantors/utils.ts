type GuarantorType = "individual" | "company";

export interface ParsedGuarantorInput {
  guarantorId: string;
  guarantorType: GuarantorType;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  icNumber?: string;
  ssmNumber?: string;
  relationship?: string;
  position: number;
  sourceData: Record<string, unknown>;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeIdentifier(value: unknown): string {
  return normalizeText(value).replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

export function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function safeToken(value: string): string {
  const compact = value.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  return compact.length > 0 ? compact : "unknown";
}

function deterministicGuarantorId(index: number, guarantorType: GuarantorType, token: string): string {
  return `g-${guarantorType}-${safeToken(token || `idx${index + 1}`)}`;
}

export function parseGuarantorsFromBusinessDetails(businessDetails: unknown): ParsedGuarantorInput[] {
  const root = toRecord(businessDetails);
  const rawGuarantors = root.guarantors;
  if (!Array.isArray(rawGuarantors)) return [];

  const result: ParsedGuarantorInput[] = [];
  for (let index = 0; index < rawGuarantors.length; index += 1) {
    const row = toRecord(rawGuarantors[index]);
    const guarantorType: GuarantorType = row.guarantor_type === "company" ? "company" : "individual";
    const email = normalizeEmail(row.email);
    if (!email) continue;

    if (guarantorType === "individual") {
      const icNumber = normalizeIdentifier(row.ic_number ?? row.icNumber);
      const explicitId = normalizeText(row.guarantor_id ?? row.guarantorId);
      result.push({
        guarantorId: explicitId || deterministicGuarantorId(index, guarantorType, icNumber),
        guarantorType,
        email,
        firstName: normalizeText(row.first_name ?? row.firstName) || undefined,
        lastName: normalizeText(row.last_name ?? row.lastName) || undefined,
        icNumber: icNumber || undefined,
        relationship: normalizeText(row.relationship) || undefined,
        position: index,
        sourceData: row,
      });
      continue;
    }

    const ssmNumber = normalizeIdentifier(row.ssm_number ?? row.ssmNumber);
    const explicitId = normalizeText(row.guarantor_id ?? row.guarantorId);
    result.push({
      guarantorId: explicitId || deterministicGuarantorId(index, guarantorType, ssmNumber),
      guarantorType,
      email,
      companyName: normalizeText(row.company_name ?? row.companyName) || undefined,
      ssmNumber: ssmNumber || undefined,
      relationship: normalizeText(row.relationship) || undefined,
      position: index,
      sourceData: row,
    });
  }

  return result;
}
