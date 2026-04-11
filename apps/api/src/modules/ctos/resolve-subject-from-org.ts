/**
 * SECTION: Map CTOS subject_ref to enquiry fields from issuer org JSON
 * WHY: Admin sends RegTank ids only; server loads IC/SSM and name from stored onboarding
 * INPUT: corporate_entities / director_kyc_status JSON; subjectRef (EOD/COD or government ID / business number); kind
 * OUTPUT: displayName + id number for CTOS batch XML, or null if not found / incomplete
 * WHERE USED: ctos-report-service subject fetch
 */

export type CtosSubjectKind = "INDIVIDUAL" | "CORPORATE";

export interface ResolvedCtosSubject {
  displayName: string;
  idNumber: string;
}

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

/** Canonical key for IC / SSM / stored subject_ref (spaces stripped, lowercase). */
export function normalizeCtosSubjectRefKey(s: unknown): string {
  return norm(s).replace(/\s+/g, "").toLowerCase();
}

function refEq(a: string, b: string): boolean {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

function idKeyEq(a: unknown, b: unknown): boolean {
  const ka = normalizeCtosSubjectRefKey(a);
  const kb = normalizeCtosSubjectRefKey(b);
  return ka.length > 0 && ka === kb;
}

function formContentArray(p: Record<string, unknown>): Array<{ fieldName?: string; fieldValue?: string }> {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const fc = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  return Array.isArray(fc?.content) ? (fc.content as Array<{ fieldName?: string; fieldValue?: string }>) : [];
}

function govIdFromCorpPerson(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const fromTop = norm(info?.governmentIdNumber);
  if (fromTop) return fromTop;
  for (const f of formContentArray(p)) {
    if (f.fieldName === "Government ID Number" && f.fieldValue) return norm(f.fieldValue);
  }
  return "";
}

function nameFromCorpPerson(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const full = norm(info?.fullName);
  if (full) return full;
  const first = norm(info?.firstName);
  const last = norm(info?.lastName);
  const joined = [first, last].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return "Unknown";
}

function corpDisplayAreas(corp: Record<string, unknown>): Array<{ displayArea?: string; content?: Array<{ fieldName?: string; fieldValue?: string }> }> {
  const fc = corp.formContent as Record<string, unknown> | undefined;
  return Array.isArray(fc?.displayAreas) ? (fc.displayAreas as Array<{ displayArea?: string; content?: Array<{ fieldName?: string; fieldValue?: string }> }>) : [];
}

function corpBasicContent(corp: Record<string, unknown>): Array<{ fieldName?: string; fieldValue?: string }> {
  const areas = corpDisplayAreas(corp);
  const basic = areas.find((a) => a.displayArea === "Basic Information Setting");
  return Array.isArray(basic?.content) ? basic!.content! : [];
}

function corpBusinessName(corp: Record<string, unknown>): string {
  const field = corpBasicContent(corp).find((f) => f.fieldName === "Business Name");
  if (field?.fieldValue) return norm(field.fieldValue);
  return norm(corp.companyName ?? corp.businessName) || "Unknown";
}

function corpBusinessNumber(corp: Record<string, unknown>): string {
  const field = corpBasicContent(corp).find((f) => f.fieldName === "Business Number");
  return field?.fieldValue ? norm(field.fieldValue) : "";
}

export function resolveCtosSubjectFromOrgJson(
  corporateEntities: unknown,
  directorKycStatus: unknown,
  subjectRef: string,
  subjectKind: CtosSubjectKind
): ResolvedCtosSubject | null {
  const ref = norm(subjectRef);
  if (!ref) return null;

  const ce = corporateEntities as Record<string, unknown> | null | undefined;

  if (subjectKind === "CORPORATE") {
    const corps = Array.isArray(ce?.corporateShareholders) ? (ce!.corporateShareholders as Record<string, unknown>[]) : [];
    for (const corp of corps) {
      const cod = norm(
        corp.requestId ?? (corp.corporateOnboardingRequest as Record<string, unknown> | undefined)?.requestId
      );
      if (!cod || !refEq(cod, ref)) continue;
      const displayName = corpBusinessName(corp);
      const idNumber = corpBusinessNumber(corp);
      if (!idNumber) return null;
      return { displayName, idNumber };
    }
    for (const corp of corps) {
      const idNumber = corpBusinessNumber(corp);
      if (!idNumber || !idKeyEq(idNumber, ref)) continue;
      return { displayName: corpBusinessName(corp), idNumber };
    }
    return null;
  }

  const ceDirectors = Array.isArray(ce?.directors) ? (ce!.directors as Record<string, unknown>[]) : [];
  const ceShareholders = Array.isArray(ce?.shareholders) ? (ce!.shareholders as Record<string, unknown>[]) : [];
  for (const p of [...ceDirectors, ...ceShareholders]) {
    if (!refEq(norm(p.eodRequestId), ref)) continue;
    const idNumber = govIdFromCorpPerson(p);
    if (!idNumber) return null;
    return { displayName: nameFromCorpPerson(p), idNumber };
  }

  const kyc = directorKycStatus as Record<string, unknown> | null | undefined;
  const kycDirs = Array.isArray(kyc?.directors) ? (kyc!.directors as Record<string, unknown>[]) : [];
  const kycIndSh = Array.isArray(kyc?.individualShareholders) ? (kyc!.individualShareholders as Record<string, unknown>[]) : [];
  for (const p of [...kycDirs, ...kycIndSh]) {
    if (!refEq(norm(p.eodRequestId), ref)) continue;
    const idNumber = norm(p.governmentIdNumber);
    if (!idNumber) return null;
    return { displayName: norm(p.name) || "Unknown", idNumber };
  }

  for (const p of [...ceDirectors, ...ceShareholders]) {
    const idNumber = govIdFromCorpPerson(p);
    if (!idNumber || !idKeyEq(idNumber, ref)) continue;
    return { displayName: nameFromCorpPerson(p), idNumber };
  }

  for (const p of [...kycDirs, ...kycIndSh]) {
    const idNumber = norm(p.governmentIdNumber);
    if (!idNumber || !idKeyEq(idNumber, ref)) continue;
    return { displayName: norm(p.name) || "Unknown", idNumber };
  }

  return null;
}
