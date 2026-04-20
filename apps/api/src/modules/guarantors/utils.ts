type GuarantorType = "individual" | "company";

export interface ParsedGuarantorInput {
  guarantorId: string;
  guarantorType: GuarantorType;
  email: string;
  name?: string;
  icNumber?: string;
  businessName?: string;
  ssmNumber?: string;
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

function deterministicGuarantorId(
  index: number,
  guarantorType: GuarantorType,
  governmentOrBusinessId: string
): string {
  return `g-${guarantorType}-${safeToken(governmentOrBusinessId || `idx${index + 1}`)}`;
}

function legacyIndividualName(raw: Record<string, unknown>): string {
  const direct = normalizeText(raw.name ?? raw.full_name ?? raw.fullName);
  if (direct) return direct;
  const first = normalizeText(raw.first_name ?? raw.firstName);
  const last = normalizeText(raw.last_name ?? raw.lastName);
  return [first, last].filter(Boolean).join(" ").trim();
}

function legacyIcNumber(raw: Record<string, unknown>): string {
  return normalizeIdentifier(
    raw.ic_number ?? raw.icNumber ?? raw.government_id_number ?? raw.governmentIdNumber
  );
}

function legacySsmNumber(raw: Record<string, unknown>): string {
  return normalizeText(
    raw.ssm_number ?? raw.ssmNumber ?? raw.business_id_number ?? raw.businessIdNumber ?? ""
  );
}

function referenceIdFromRow(raw: Record<string, unknown>): string {
  return normalizeText(raw.reference_id ?? raw.referenceId ?? raw.guarantor_id ?? raw.guarantorId);
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
      const ic = legacyIcNumber(row);
      const explicitId = referenceIdFromRow(row);
      const name = legacyIndividualName(row);
      result.push({
        guarantorId: explicitId || deterministicGuarantorId(index, guarantorType, ic),
        guarantorType,
        email,
        name: name || undefined,
        icNumber: ic || undefined,
        position: index,
        sourceData: row,
      });
      continue;
    }

    const ssm = legacySsmNumber(row);
    const explicitId = referenceIdFromRow(row);
    const businessName = normalizeText(row.business_name ?? row.businessName ?? row.company_name ?? row.companyName);
    result.push({
      guarantorId: explicitId || deterministicGuarantorId(index, guarantorType, normalizeIdentifier(ssm)),
      guarantorType,
      email,
      businessName: businessName || undefined,
      ssmNumber: ssm || undefined,
      position: index,
      sourceData: row,
    });
  }

  return result;
}
