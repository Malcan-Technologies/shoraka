/**
 * SECTION: CTOS vs onboarding application (admin manual layout)
 * WHY: SSM/CTOS step shows application data and CTOS extract separately; admin matches by eye
 * INPUT: onboarding application + optional CTOS company_json + fetch state
 * OUTPUT: company fields, director/shareholder buckets (matched / only application / only CTOS)
 * WHERE USED: SSMVerificationPanel
 */

import {
  getDisplayRoleLabel,
  governmentIdFromDirectorKycForEod,
  shouldIncludePerson,
  type DirectorKycStatus,
  type OnboardingApplicationResponse,
} from "@cashsouk/types";

/** Org-level CTOS list: nothing loaded / loaded but unusable / ready to compare. */
export type OnboardingCtosOrgFetchState = "not_pulled" | "no_record" | "ready";

export interface CtosOrgDirectorParsed {
  ic_lcno: string | null;
  nic_brno: string | null;
  brn_ssm: string | null;
  name: string | null;
  position: string | null;
  equity_percentage: number | null;
  equity: number | null;
  party_type: string | null;
}

function getCtosId(x: unknown): string | null {
  if (!x || typeof x !== "object") return null;
  const row = x as Record<string, unknown>;
  const partyType = typeof row.party_type === "string" ? row.party_type.trim().toUpperCase() : "";
  if (partyType === "I") {
    const id = row.nic_brno;
    if (typeof id === "string" && id.trim()) {
      return id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }
    return null;
  }
  if (partyType === "C") {
    const id =
      typeof row.ic_lcno === "string" && row.ic_lcno.trim()
        ? row.ic_lcno
        : row.brn_ssm;
    if (typeof id === "string" && id.trim()) {
      return id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }
    return null;
  }
  return null;
}

export interface OnboardingCompanyTable {
  applicationName: string;
  applicationReg: string;
  ctosName: string | null;
  ctosReg: string | null;
}

export interface OnboardingPeopleBuckets {
  matched: Array<{ app: DirectorKycStatus; ctos: CtosOrgDirectorParsed }>;
  onlyApplication: DirectorKycStatus[];
  onlyCtos: CtosOrgDirectorParsed[];
}

export interface OnboardingCtosManualComparison {
  company: OnboardingCompanyTable;
  directors: OnboardingPeopleBuckets;
  shareholders: OnboardingPeopleBuckets;
}

/** Trim, uppercase, strip non-alphanumerics — for IC/SSM compare only. */
export function normalizeId(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  return s.length > 0 ? s : null;
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

export function primaryCtosIdFromDirectorRow(r: CtosOrgDirectorParsed): string {
  return getCtosId(r) ?? "";
}

export function displayIdFromApp(governmentId: string | null | undefined): string | null {
  const s = String(governmentId ?? "").trim();
  return s || null;
}

export function displayIdFromCtosRow(r: CtosOrgDirectorParsed): string | null {
  const s = primaryCtosIdFromDirectorRow(r).trim();
  return s || null;
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
      brn_ssm: x.brn_ssm != null ? String(x.brn_ssm) : null,
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
  return directors.filter((d) => {
    const role = String(d.role ?? "");
    const roleLower = role.toLowerCase();
    const isDirector = roleLower.includes("director");
    const isShareholder = roleLower.includes("shareholder");
    const sharePct = shareholderPctFromAppRole(role);
    return shouldIncludePerson({
      type: "INDIVIDUAL",
      isDirector,
      isShareholder,
      sharePercentage: sharePct,
    }) && isDirector;
  });
}

function appShareholdersFromKyc(directors: DirectorKycStatus[] | undefined): DirectorKycStatus[] {
  if (!directors?.length) return [];
  return directors.filter((d) => {
    const role = String(d.role ?? "");
    const roleLower = role.toLowerCase();
    const isDirector = roleLower.includes("director");
    const isShareholder = roleLower.includes("shareholder");
    const sharePct = shareholderPctFromAppRole(role);
    return shouldIncludePerson({
      type: "INDIVIDUAL",
      isDirector,
      isShareholder,
      sharePercentage: sharePct,
    }) && !isDirector && isShareholder;
  });
}

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
  if (!own) {
    return getDisplayRoleLabel({
      isDirector: false,
      isShareholder: true,
      sharePercentage: 0,
    }) || "Shareholder";
  }
  const m = /^([\d.]+)/.exec(own);
  const pct = m ? Number(m[1]) : 0;
  return (
    getDisplayRoleLabel({
      isDirector: false,
      isShareholder: true,
      sharePercentage: Number.isFinite(pct) ? pct : 0,
    }) || "Shareholder"
  );
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

function corpShareholderPct(corp: Record<string, unknown>): number | null {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    const content = Array.isArray((area as Record<string, unknown>)?.content)
      ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
      : [];
    const pctField = content.find((f) => f.fieldName === "% of Shares");
    if (!pctField?.fieldValue) continue;
    const pct =
      typeof pctField.fieldValue === "string"
        ? Number(pctField.fieldValue)
        : pctField.fieldValue;
    if (typeof pct === "number" && Number.isFinite(pct)) return pct;
  }
  return null;
}

function corporateEntitiesHasPeople(
  ce: NonNullable<OnboardingApplicationResponse["corporateEntities"]>
): boolean {
  return (
    (ce.directors?.length ?? 0) + (ce.shareholders?.length ?? 0) + (ce.corporateShareholders?.length ?? 0) > 0
  );
}

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
    const pct = corpShareholderPct(corp);
    if (pct === null || pct < 5) continue;
    const codRequestId = String(
      (corp.corporateOnboardingRequest as Record<string, unknown> | undefined)?.requestId ??
        corp.requestId ??
        ""
    ).trim();
    rows.push({
      eodRequestId: codRequestId || `ce-corp-${idx++}`,
      name: corpShareholderName(corp),
      email: "",
      role: `Corporate Shareholder (${pct}%)`,
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

/** For mock CTOS preview — same director/shareholder split as the compare tables. */
export function getOnboardingPeopleSplit(application: OnboardingApplicationResponse): {
  directors: DirectorKycStatus[];
  shareholders: DirectorKycStatus[];
} {
  const kycList = effectiveKycDirectors(application);
  return {
    directors: appDirectorsFromKyc(kycList),
    shareholders: appShareholdersFromKyc(kycList),
  };
}

/** Company block uses root `ptype` (not row-level `party_type`). */
function parseCtosNameReg(companyJson: unknown): { ctosName: string | null; ctosReg: string | null } {
  const cj = companyJson as Record<string, unknown> | null | undefined;
  if (!cj || typeof cj !== "object") return { ctosName: null, ctosReg: null };
  const ctosName = cj.name != null ? String(cj.name) : null;
  const partyType = String(cj.ptype ?? "").trim().toUpperCase();

  let ctosReg: string | null = null;
  if (partyType === "C") {
    const ic = cj.ic_lcno != null ? String(cj.ic_lcno).trim() : "";
    const brn = cj.brn_ssm != null ? String(cj.brn_ssm).trim() : "";
    ctosReg = ic || brn || null;
  } else if (partyType === "I") {
    const nb = cj.nic_brno != null ? String(cj.nic_brno).trim() : "";
    ctosReg = nb || null;
  }

  return { ctosName, ctosReg };
}

/** At least company name or SSM in extract — enough to compare registry fields. */
export function companyJsonUsableForRegistryCompare(companyJson: unknown): boolean {
  const { ctosName, ctosReg } = parseCtosNameReg(companyJson);
  if (ctosName != null && String(ctosName).trim() !== "") return true;
  const digits = String(ctosReg ?? "").replace(/\D/g, "");
  return digits.length > 0;
}

/** Report row has usable `company_json` (registry fields and/or director list). */
export function companyJsonReadyForCtosCompare(companyJson: unknown): boolean {
  if (!companyJson || typeof companyJson !== "object") return false;
  if (companyJsonUsableForRegistryCompare(companyJson)) return true;
  const cj = companyJson as { directors?: unknown };
  return Array.isArray(cj.directors) && cj.directors.length > 0;
}

/** Parse % from role like "Shareholder (35%)". Invalid → 0. */
export function shareholderPctFromAppRole(role: string): number {
  const m = /\(\s*([\d.]+%?)\s*\)/.exec(role);
  if (!m) return 0;
  const n = parseFloat(String(m[1]).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

/** CTOS equity_percentage: treat 0–1 as fraction of 100. */
export function shareholderPctFromCtosRow(r: CtosOrgDirectorParsed): number {
  const a = r.equity_percentage;
  if (typeof a === "number" && !Number.isNaN(a)) {
    if (a > 0 && a <= 1) return a * 100;
    return a;
  }
  return 0;
}

function qualifiesCtosDirector(r: CtosOrgDirectorParsed): boolean {
  return isCtosDirectorTableRow(ctosPositionCode(r.position));
}

function qualifiesCtosShareholder(r: CtosOrgDirectorParsed): boolean {
  return isCtosShareholderTableRow(ctosPositionCode(r.position));
}

/**
 * SECTION: First-wins partition by normalizeId
 * WHY: Same IC twice on application — first row matches first free CTOS row; extras stay only-application
 */
function partitionPeople(
  appList: DirectorKycStatus[],
  ctosAll: CtosOrgDirectorParsed[],
  qualifies: (r: CtosOrgDirectorParsed) => boolean,
  used: Set<number>
): { matched: OnboardingPeopleBuckets["matched"]; matchedCtosIndices: Set<number> } {
  const matched: OnboardingPeopleBuckets["matched"] = [];
  const matchedCtosIndices = new Set<number>();
  for (const app of appList) {
    const key = normalizeId(app.governmentIdNumber);
    if (!key) continue;
    let found = -1;
    for (let i = 0; i < ctosAll.length; i++) {
      if (used.has(i)) continue;
      const row = ctosAll[i];
      if (!qualifies(row)) continue;
      const ctosKey = normalizeId(primaryCtosIdFromDirectorRow(row));
      if (!ctosKey || ctosKey !== key) continue;
      found = i;
      break;
    }
    if (found >= 0) {
      used.add(found);
      matchedCtosIndices.add(found);
      matched.push({ app, ctos: ctosAll[found] });
    }
  }
  return { matched, matchedCtosIndices };
}

function onlyApplicationPeople(appList: DirectorKycStatus[], matched: OnboardingPeopleBuckets["matched"]): DirectorKycStatus[] {
  const matchedIds = new Set(matched.map((m) => m.app.eodRequestId));
  return appList.filter((a) => {
    const key = normalizeId(a.governmentIdNumber);
    if (!key) return true;
    return !matchedIds.has(a.eodRequestId);
  });
}

function onlyCtosPeople(
  ctosAll: CtosOrgDirectorParsed[],
  qualifies: (r: CtosOrgDirectorParsed) => boolean,
  allMatchedIndices: Set<number>
): CtosOrgDirectorParsed[] {
  const out: CtosOrgDirectorParsed[] = [];
  for (let i = 0; i < ctosAll.length; i++) {
    if (!qualifies(ctosAll[i])) continue;
    if (allMatchedIndices.has(i)) continue;
    out.push(ctosAll[i]);
  }
  return out;
}

export function buildOnboardingCtosComparison(
  application: OnboardingApplicationResponse,
  companyJson: unknown | null,
  orgFetchState: OnboardingCtosOrgFetchState
): OnboardingCtosManualComparison {
  const ready = orgFetchState === "ready";
  const appName = application.organizationName?.trim() || "—";
  const appReg = application.registrationNumber?.trim() || "—";
  const { ctosName, ctosReg } = parseCtosNameReg(companyJson);

  const company: OnboardingCompanyTable = {
    applicationName: appName,
    applicationReg: appReg,
    ctosName: ready ? (ctosName != null && String(ctosName).trim() !== "" ? String(ctosName).trim() : null) : null,
    ctosReg: ready ? (ctosReg != null && String(ctosReg).trim() !== "" ? String(ctosReg).trim() : null) : null,
  };

  const kycList = effectiveKycDirectors(application);
  const appDirList = appDirectorsFromKyc(kycList);
  const appShList = appShareholdersFromKyc(kycList);
  const appShFiltered = appShList;

  const ctosAll = ready && companyJson ? extractCtosOrgDirectorsFromCompanyJson(companyJson) : [];

  const used = new Set<number>();
  const dirPart = partitionPeople(appDirList, ctosAll, qualifiesCtosDirector, used);
  const shPart = partitionPeople(
    appShFiltered,
    ctosAll,
    (r) => qualifiesCtosShareholder(r) && shareholderPctFromCtosRow(r) >= 5,
    used
  );

  const allMatched = new Set([...dirPart.matchedCtosIndices, ...shPart.matchedCtosIndices]);

  const directors: OnboardingPeopleBuckets = {
    matched: dirPart.matched,
    onlyApplication: onlyApplicationPeople(appDirList, dirPart.matched),
    onlyCtos: onlyCtosPeople(ctosAll, qualifiesCtosDirector, allMatched),
  };

  const shareholders: OnboardingPeopleBuckets = {
    matched: shPart.matched,
    onlyApplication: onlyApplicationPeople(appShFiltered, shPart.matched),
    onlyCtos: onlyCtosPeople(
      ctosAll,
      (r) => qualifiesCtosShareholder(r) && shareholderPctFromCtosRow(r) >= 5,
      allMatched
    ),
  };

  if (process.env.NODE_ENV === "development") {
    console.log("[CTOS compare] manual buckets", {
      orgFetchState,
      ready,
      directors: {
        matched: directors.matched.length,
        onlyApp: directors.onlyApplication.length,
        onlyCtos: directors.onlyCtos.length,
      },
      shareholders: {
        matched: shareholders.matched.length,
        onlyApp: shareholders.onlyApplication.length,
        onlyCtos: shareholders.onlyCtos.length,
      },
    });
  }

  return { company, directors, shareholders };
}
