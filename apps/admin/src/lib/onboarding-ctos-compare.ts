/**
 * SECTION: CTOS vs onboarding application comparison (admin)
 * WHY: SSM/CTOS verification step shows Application vs CTOS columns and checklist
 * INPUT: onboarding application + optional CTOS company_json
 * OUTPUT: row models and checklist flags for the verification panel
 * WHERE USED: SSMVerificationPanel
 * NOTE: Director/shareholder Application column uses corporate_entities first (same as financing review),
 * then director_kyc_status only when CE has no people rows.
 */

import {
  governmentIdFromDirectorKycForEod,
  type DirectorKycStatus,
  type OnboardingApplicationResponse,
} from "@cashsouk/types";

interface CtosOrgDirectorParsed {
  ic_lcno: string | null;
  nic_brno: string | null;
  name: string | null;
  position: string | null;
  equity_percentage: number | null;
  equity: number | null;
  party_type: string | null;
}

export interface OnboardingVerificationRow {
  appCell: string;
  ctosCell: string | null;
  match: boolean;
}

export interface OnboardingCtosComparison {
  companyName: OnboardingVerificationRow;
  registration: OnboardingVerificationRow;
  /** Application industry vs CTOS `type_of_business` (CCM nature of business). */
  industryActivity: OnboardingVerificationRow;
  /** Application entity type vs CTOS `comp_type` / `comp_category` (SSM). */
  entityType: OnboardingVerificationRow;
  directors: OnboardingVerificationRow[];
  shareholders: OnboardingVerificationRow[];
  checklist: { id: string; label: string; ok: boolean }[];
}

function normalizeIdKey(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!s) return null;
  return s.toLowerCase();
}

function stripCompanySuffixes(s: string): string {
  return s
    .replace(/\b(sdn\.?\s*bhd|sdn bhd|berhad|bhd)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompanyName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Loose name match: exact, substring, or after stripping legal suffixes */
function namesLooselyMatchApplicationVsCtos(appName: string, ctosName: string | null | undefined): boolean {
  const a = normalizeCompanyName(appName);
  const c = normalizeCompanyName(ctosName ?? "");
  if (!a || !c) return false;
  if (a === c) return true;
  if (c.includes(a) || a.includes(c)) return true;
  const sa = stripCompanySuffixes(a);
  const sc = stripCompanySuffixes(c);
  return sc.includes(sa) || sa.includes(sc);
}

function registrationNumbersMatch(appReg: string | null | undefined, ctosReg: string | null | undefined): boolean {
  const digits = (x: string) => x.replace(/\D/g, "");
  const a = digits(String(appReg ?? ""));
  const b = digits(String(ctosReg ?? ""));
  if (!a || !b) return false;
  return a === b;
}

function ctosPositionCode(position: string | null | undefined): string {
  return String(position ?? "").trim().toUpperCase();
}

function isCtosDirectorTableRow(code: string): boolean {
  return code === "DO" || code === "AD" || code === "DS" || code === "AS";
}

function isCtosShareholderTableRow(code: string): boolean {
  return code === "SO" || code === "DS" || code === "AS";
}

function primaryCtosIdFromDirectorRow(r: CtosOrgDirectorParsed): string {
  const a = r.nic_brno != null ? String(r.nic_brno).trim() : "";
  const b = r.ic_lcno != null ? String(r.ic_lcno).trim() : "";
  return a || b;
}

function ownershipLabelFromCtos(r: CtosOrgDirectorParsed): string | null {
  if (r.equity_percentage != null && !Number.isNaN(Number(r.equity_percentage))) {
    return `${r.equity_percentage}%`;
  }
  if (r.equity != null && !Number.isNaN(Number(r.equity))) {
    return `${r.equity}%`;
  }
  return null;
}

function extractCtosOrgDirectorsFromCompanyJson(companyJson: unknown): CtosOrgDirectorParsed[] {
  const cj = companyJson as { directors?: unknown } | null | undefined;
  const raw = Array.isArray(cj?.directors) ? cj!.directors : [];
  const out: CtosOrgDirectorParsed[] = [];
  for (const d of raw) {
    const x = d as Record<string, unknown>;
    const ptRaw = x.party_type != null ? String(x.party_type).trim() : "";
    out.push({
      ic_lcno: x.ic_lcno != null ? String(x.ic_lcno) : null,
      nic_brno: x.nic_brno != null ? String(x.nic_brno) : null,
      name: x.name != null ? String(x.name) : null,
      position: x.position != null ? String(x.position) : null,
      equity_percentage: typeof x.equity_percentage === "number" ? x.equity_percentage : null,
      equity: typeof x.equity === "number" ? x.equity : null,
      party_type: ptRaw !== "" ? ptRaw : null,
    });
  }
  return out;
}

function appDirectorsFromKyc(directors: DirectorKycStatus[] | undefined): DirectorKycStatus[] {
  if (!directors?.length) return [];
  return directors.filter((d) => /director/i.test(d.role));
}

function appShareholdersFromKyc(directors: DirectorKycStatus[] | undefined): DirectorKycStatus[] {
  if (!directors?.length) return [];
  return directors.filter((d) => /shareholder/i.test(d.role));
}

function shareholderPercentFromRole(role: string): string | null {
  const m = /\(([^)]+)\)/.exec(role);
  if (!m) return null;
  const inner = m[1].trim();
  if (/\d/.test(inner)) return inner.replace(/\s*%?\s*$/, "").trim() + (inner.includes("%") ? "" : "%");
  return null;
}

function appShareholderDisplayName(d: DirectorKycStatus): string {
  const pct = shareholderPercentFromRole(d.role);
  return pct ? `${d.name} (${pct})` : d.name;
}

function ctosShareholderDisplayName(r: CtosOrgDirectorParsed): string {
  const own = ownershipLabelFromCtos(r);
  const n = (r.name ?? "").trim() || "—";
  return own ? `${n} (${own})` : n;
}

function namesMatchLoose(a: string, b: string | null | undefined): boolean {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b ?? "");
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Compare shareholder name and optional % from application role vs CTOS equity fields */
function shareholderDisplayMatch(d: DirectorKycStatus, ctosRow: CtosOrgDirectorParsed | undefined): boolean {
  if (!ctosRow) return false;
  const appLabel = appShareholderDisplayName(d);
  const ctosLabel = ctosShareholderDisplayName(ctosRow);
  if (!namesMatchLoose(d.name, ctosRow.name)) return false;
  const pctApp = shareholderPercentFromRole(d.role);
  const pctCtos = ownershipLabelFromCtos(ctosRow);
  if (pctApp && pctCtos) {
    const da = pctApp.replace(/\D/g, "");
    const db = pctCtos.replace(/\D/g, "");
    if (da && db) return da === db;
  }
  return appLabel.length > 0 && ctosLabel.length > 0;
}

function applicationIndustryLabel(application: OnboardingApplicationResponse): string {
  return application.corporateBasicInfo?.industry?.trim() || "—";
}

function applicationEntityTypeLabel(application: OnboardingApplicationResponse): string {
  return application.corporateBasicInfo?.entityType?.trim() || "—";
}

/** CTOS SSM company type: `comp_type` label + optional `comp_category` (see ctos.response.txt section_a). */
function ctosEntityTypeDisplay(cj: Record<string, unknown> | null | undefined): string | null {
  if (!cj) return null;
  const t = cj.comp_type != null ? String(cj.comp_type).trim() : "";
  const c = cj.comp_category != null ? String(cj.comp_category).trim() : "";
  if (t && c) return `${t} · ${c}`;
  if (t) return t;
  if (c) return c;
  return null;
}

/** Loose string match for free-text industry/entity labels (substring / token overlap). */
function businessTypesLooselyMatch(appLabel: string, ctos: string | null | undefined): boolean {
  if (appLabel === "—" || !ctos?.trim()) return false;
  const a = normalizeCompanyName(appLabel);
  const c = normalizeCompanyName(ctos);
  if (!a || !c) return false;
  if (a === c || c.includes(a) || a.includes(c)) return true;
  for (const part of a.split(/[(),/&]+/).map((p) => p.trim()).filter(Boolean)) {
    if (part.length > 2 && c.includes(part)) return true;
  }
  return false;
}

/** Same shape as financing-review `personNameFromCe` (corporate_entities person row) */
function personNameFromCe(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const full = String(info?.fullName ?? "").trim();
  if (full) return full;
  const first = String(info?.firstName ?? "").trim();
  const last = String(info?.lastName ?? "").trim();
  return [first, last].filter(Boolean).join(" ").trim();
}

function ownershipFromCePerson(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const shareField = content.find((f) => f.fieldName === "% of Shares");
  return shareField?.fieldValue ? `${shareField.fieldValue}% ownership` : null;
}

function issuerIcOrSsmFromCorpPerson(p: Record<string, unknown>): string | undefined {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const fromTop = String(info?.governmentIdNumber ?? "").trim();
  if (fromTop) return fromTop;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const idField = content.find((f) => f.fieldName === "Government ID Number");
  if (idField?.fieldValue) return String(idField.fieldValue).trim();
  return undefined;
}

function issuerIcOrSsmForCePersonRow(p: Record<string, unknown>, directorKycJson: unknown): string | undefined {
  const fromCe = issuerIcOrSsmFromCorpPerson(p);
  if (fromCe) return fromCe;
  const eod = String(p.eodRequestId ?? "").trim();
  return governmentIdFromDirectorKycForEod(directorKycJson, eod) ?? undefined;
}

function roleForCeShareholder(p: Record<string, unknown>): string {
  const own = ownershipFromCePerson(p);
  if (!own) return "Shareholder";
  const m = /^([\d.]+)/.exec(own);
  return m ? `Shareholder (${m[1]}%)` : "Shareholder";
}

function corpShareholderName(corp: Record<string, unknown>): string {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    const content = Array.isArray((area as Record<string, unknown>)?.content)
      ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
      : [];
    const bn = content.find((f) => f.fieldName === "Business Name");
    if (bn?.fieldValue) return String(bn.fieldValue);
  }
  return String(corp.companyName ?? corp.businessName ?? "Unknown");
}

function corpShareholderBrn(corp: Record<string, unknown>): string | undefined {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    const content = Array.isArray((area as Record<string, unknown>)?.content)
      ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
      : [];
    const numField = content.find((f) => f.fieldName === "Business Number");
    if (numField?.fieldValue) return String(numField.fieldValue).trim();
  }
  return undefined;
}

function corporateEntitiesHasPeople(
  ce: NonNullable<OnboardingApplicationResponse["corporateEntities"]>
): boolean {
  return (
    (ce.directors?.length ?? 0) + (ce.shareholders?.length ?? 0) + (ce.corporateShareholders?.length ?? 0) > 0
  );
}

/**
 * CE-first list (same rule as financing `extractDirectorShareholders`): order and IDs from
 * corporate_entities; fill missing IC from director_kyc_status JSON by EOD.
 */
function directorKycRowsFromCorporateEntities(
  ce: NonNullable<OnboardingApplicationResponse["corporateEntities"]>,
  directorKycStatus: OnboardingApplicationResponse["directorKycStatus"]
): DirectorKycStatus[] {
  const kycJson = directorKycStatus as unknown;
  const rows: DirectorKycStatus[] = [];
  let idx = 0;
  for (const d of ce.directors ?? []) {
    const p = d as Record<string, unknown>;
    const name = personNameFromCe(p);
    if (!name) continue;
    const eod = String(p.eodRequestId ?? "").trim();
    rows.push({
      eodRequestId: eod || `ce-dir-${idx++}`,
      name,
      email: "",
      role: "Director",
      kycStatus: "APPROVED",
      governmentIdNumber: issuerIcOrSsmForCePersonRow(p, kycJson),
      lastUpdated: new Date(0).toISOString(),
    });
  }
  for (const s of ce.shareholders ?? []) {
    const p = s as Record<string, unknown>;
    const name = personNameFromCe(p);
    if (!name) continue;
    const eod = String(p.eodRequestId ?? "").trim();
    rows.push({
      eodRequestId: eod || `ce-sh-${idx++}`,
      name,
      email: "",
      role: roleForCeShareholder(p),
      kycStatus: "APPROVED",
      governmentIdNumber: issuerIcOrSsmForCePersonRow(p, kycJson),
      lastUpdated: new Date(0).toISOString(),
    });
  }
  for (const c of ce.corporateShareholders ?? []) {
    const corp = c as Record<string, unknown>;
    const codRequestId = String(
      (corp.corporateOnboardingRequest as Record<string, unknown> | undefined)?.requestId ??
        corp.requestId ??
        ""
    ).trim();
    rows.push({
      eodRequestId: codRequestId || `ce-corp-${idx++}`,
      name: corpShareholderName(corp),
      email: "",
      role: "Corporate Shareholder",
      kycStatus: "APPROVED",
      governmentIdNumber: corpShareholderBrn(corp),
      lastUpdated: new Date(0).toISOString(),
    });
  }
  return rows;
}

function effectiveKycDirectors(application: OnboardingApplicationResponse): DirectorKycStatus[] {
  const ce = application.corporateEntities;
  const fromKyc = application.directorKycStatus?.directors;
  if (ce && corporateEntitiesHasPeople(ce)) {
    return directorKycRowsFromCorporateEntities(ce, application.directorKycStatus);
  }
  if (fromKyc && fromKyc.length > 0) return fromKyc;
  return [];
}

export function buildOnboardingCtosComparison(
  application: OnboardingApplicationResponse,
  companyJson: unknown | null
): OnboardingCtosComparison {
  const appName = application.organizationName?.trim() || "—";
  const appReg = application.registrationNumber?.trim() || "—";

  const cj = companyJson as Record<string, unknown> | null | undefined;
  const ctosName = cj?.name != null ? String(cj.name) : null;
  const ctosReg =
    cj?.brn_ssm != null
      ? String(cj.brn_ssm)
      : cj?.nic_brno != null
        ? String(cj.nic_brno)
        : cj?.ic_lcno != null
          ? String(cj.ic_lcno)
          : null;
  const hasCtos = Boolean(companyJson && typeof companyJson === "object");
  const ctosTypeOfBusiness = cj?.type_of_business != null ? String(cj.type_of_business) : null;
  const ctosEntityDisplay = hasCtos ? ctosEntityTypeDisplay(cj) : null;

  const companyName: OnboardingVerificationRow = {
    appCell: appName,
    ctosCell: hasCtos ? ctosName : null,
    match: hasCtos && namesLooselyMatchApplicationVsCtos(appName, ctosName),
  };

  const registration: OnboardingVerificationRow = {
    appCell: appReg,
    ctosCell: hasCtos ? (ctosReg?.trim() || "—") : null,
    match: hasCtos && registrationNumbersMatch(application.registrationNumber, ctosReg),
  };

  const appIndustry = applicationIndustryLabel(application);
  const industryActivity: OnboardingVerificationRow = {
    appCell: appIndustry,
    ctosCell: hasCtos ? (ctosTypeOfBusiness ?? "—") : null,
    match:
      hasCtos &&
      appIndustry !== "—" &&
      Boolean(ctosTypeOfBusiness?.trim()) &&
      businessTypesLooselyMatch(appIndustry, ctosTypeOfBusiness),
  };

  const appEntity = applicationEntityTypeLabel(application);
  const entityType: OnboardingVerificationRow = {
    appCell: appEntity,
    ctosCell: hasCtos ? (ctosEntityDisplay ?? "—") : null,
    match:
      hasCtos &&
      appEntity !== "—" &&
      Boolean(ctosEntityDisplay?.trim()) &&
      businessTypesLooselyMatch(appEntity, ctosEntityDisplay),
  };

  const ctosRows = hasCtos ? extractCtosOrgDirectorsFromCompanyJson(companyJson) : [];

  const ctosByKey = new Map<string, CtosOrgDirectorParsed[]>();
  for (const r of ctosRows) {
    const k = normalizeIdKey(primaryCtosIdFromDirectorRow(r));
    if (!k) continue;
    const arr = ctosByKey.get(k) ?? [];
    arr.push(r);
    ctosByKey.set(k, arr);
  }

  const kycList = effectiveKycDirectors(application);
  const appDirList = appDirectorsFromKyc(kycList);
  const directors: OnboardingVerificationRow[] = appDirList.map((d) => {
    const k = normalizeIdKey(d.governmentIdNumber);
    const candidates = k ? ctosByKey.get(k) ?? [] : [];
    const ctosSide = candidates.find((c) => isCtosDirectorTableRow(ctosPositionCode(c.position)));
    const ctosCell = ctosSide ? (ctosSide.name ?? "").trim() || "—" : null;
    const match =
      Boolean(ctosSide) &&
      namesMatchLoose(d.name, ctosSide!.name) &&
      isCtosDirectorTableRow(ctosPositionCode(ctosSide!.position));
    return { appCell: d.name, ctosCell, match };
  });

  const appShList = appShareholdersFromKyc(kycList);
  const shareholders: OnboardingVerificationRow[] = appShList.map((d) => {
    const k = normalizeIdKey(d.governmentIdNumber);
    const candidates = k ? ctosByKey.get(k) ?? [] : [];
    const ctosSide = candidates.find((c) => isCtosShareholderTableRow(ctosPositionCode(c.position)));
    const ctosCell = ctosSide ? ctosShareholderDisplayName(ctosSide) : null;
    const match = Boolean(ctosSide) && shareholderDisplayMatch(d, ctosSide);
    return { appCell: appShareholderDisplayName(d), ctosCell, match };
  });

  const directorsMatch =
    appDirList.length === 0
      ? true
      : hasCtos && appDirList.length > 0 && directors.length > 0 && directors.every((r) => r.match);

  const shareholdersMatch =
    appShList.length === 0
      ? true
      : hasCtos && appShList.length > 0 && shareholders.length > 0 && shareholders.every((r) => r.match);

  const checklist: { id: string; label: string; ok: boolean }[] = [
    { id: "name", label: "Company name matches CTOS", ok: companyName.match },
    { id: "reg", label: "Registration number matches CTOS", ok: registration.match },
    {
      id: "industry",
      label: "Industry / activity matches CTOS (type of business)",
      ok: !hasCtos || appIndustry === "—" || industryActivity.match,
    },
    {
      id: "entity",
      label: "Entity type matches CTOS (SSM company type)",
      ok: !hasCtos || appEntity === "—" || entityType.match,
    },
    { id: "dir", label: "Directors match CTOS (by ID)", ok: directorsMatch },
    { id: "sh", label: "Shareholders match CTOS (by ID and % where available)", ok: shareholdersMatch },
  ];

  return {
    companyName,
    registration,
    industryActivity,
    entityType,
    directors,
    shareholders,
    checklist,
  };
}
