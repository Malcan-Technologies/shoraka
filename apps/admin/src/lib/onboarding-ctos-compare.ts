/**
 * SECTION: CTOS vs onboarding application (admin manual layout)
 * WHY: SSM/CTOS step shows application data and CTOS extract separately; admin matches by eye
 * INPUT: onboarding application + optional CTOS company_json + fetch state
 * OUTPUT: company fields, director/shareholder buckets (matched / only application / only CTOS)
 * WHERE USED: SSMVerificationPanel
 */

import {
  extractGovernmentId,
  getDisplayRoleLabel,
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
    const eqRaw = x.equity_percentage;
    const equityPct =
      typeof eqRaw === "number"
        ? eqRaw
        : typeof eqRaw === "string"
          ? Number(eqRaw)
          : null;
    const equityNum =
      typeof equityPct === "number" && Number.isFinite(equityPct) ? equityPct : null;
    out.push({
      ic_lcno: x.ic_lcno != null ? String(x.ic_lcno) : null,
      nic_brno: x.nic_brno != null ? String(x.nic_brno) : null,
      brn_ssm: x.brn_ssm != null ? String(x.brn_ssm) : null,
      name: x.name != null ? String(x.name) : null,
      position: x.position != null ? String(x.position) : null,
      equity_percentage: equityNum,
      equity: typeof x.equity === "number" ? x.equity : null,
      party_type: ptRaw !== "" ? ptRaw : null,
    });
  }
  return out;
}

/**
 * SECTION: "% of Shares" from corporateEntities formContent only
 * WHY: Nested personalInfo/formContent/displayAreas hold the field — not role or row.sharePercentage
 * INPUT: fieldValue from a form row; CE shareholder blobs
 * OUTPUT: Finite percent or null for map / filter / UI
 * WHERE USED: buildSharePctMapFromCorporateEntities, synthetic CE shareholder rows
 */

function parsePctOfSharesFieldValue(value: unknown): number | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : null;
  if (typeof num !== "number" || !Number.isFinite(num)) return null;
  return num;
}

function findPctOfSharesInFlatContentFields(content: unknown[]): number | null {
  for (const field of content) {
    if (!field || typeof field !== "object" || Array.isArray(field)) continue;
    const f = field as Record<string, unknown>;
    if (String(f.fieldName ?? "").trim() !== "% of Shares") continue;
    const pct = parsePctOfSharesFieldValue(f.fieldValue);
    if (pct !== null) return pct;
  }
  return null;
}

/** Individual: personalInfo.formContent.content[], else root formContent.content (same field list). */
function sharePctFromIndividualShareholderEntity(p: Record<string, unknown>): number | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const fromPersonal = info?.formContent as Record<string, unknown> | undefined;
  if (Array.isArray(fromPersonal?.content)) {
    const hit = findPctOfSharesInFlatContentFields(fromPersonal.content as unknown[]);
    if (hit !== null) return hit;
  }
  const rootFc = p.formContent as Record<string, unknown> | undefined;
  if (Array.isArray(rootFc?.content)) {
    return findPctOfSharesInFlatContentFields(rootFc.content as unknown[]);
  }
  return null;
}

/** Corporate: BN + "% of Shares" only from formContent.displayAreas[].content[] */
function corporateBnAndPctOfSharesFromCe(
  corp: Record<string, unknown>
): { businessNumber: string | null; pct: number | null } {
  let businessNumber: string | null = null;
  let pct: number | null = null;
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    if (!area || typeof area !== "object" || Array.isArray(area)) continue;
    const content = Array.isArray((area as Record<string, unknown>).content)
      ? ((area as Record<string, unknown>).content as unknown[])
      : [];
    const hitPct = findPctOfSharesInFlatContentFields(content);
    if (hitPct !== null && pct === null) pct = hitPct;
    for (const field of content) {
      if (!field || typeof field !== "object" || Array.isArray(field)) continue;
      const f = field as Record<string, unknown>;
      if (String(f.fieldName ?? "").trim() !== "Business Number") continue;
      const raw = String(f.fieldValue ?? "").trim();
      if (raw && businessNumber === null) businessNumber = raw;
    }
  }
  return { businessNumber, pct };
}

function sharePctFromCorporateEntityDisplayAreas(corp: Record<string, unknown>): number | null {
  const { pct } = corporateBnAndPctOfSharesFromCe(corp);
  return pct;
}

function governmentIdFromCeShareholder(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const top = String(info?.governmentIdNumber ?? p.governmentIdNumber ?? "").trim();
  if (top) return top;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content) ? (formContent.content as unknown[]) : [];
  for (const field of content) {
    if (!field || typeof field !== "object" || Array.isArray(field)) continue;
    const f = field as Record<string, unknown>;
    if (String(f.fieldName ?? "").trim() !== "Government ID Number") continue;
    const val = String(f.fieldValue ?? "").trim();
    if (val) return val;
  }
  return null;
}

export function buildSharePctMapFromCorporateEntities(
  ce: OnboardingApplicationResponse["corporateEntities"]
): Map<string, number> {
  const map = new Map<string, number>();
  if (!ce) return map;

  for (const s of ce.shareholders ?? []) {
    const p = s as Record<string, unknown>;
    const pct = sharePctFromIndividualShareholderEntity(p);
    if (pct === null) continue;
    const id = normalizeId(governmentIdFromCeShareholder(p));
    if (id) map.set(id, pct);
    const eodKey = normalizeId(String(p.eodRequestId ?? "").trim());
    if (eodKey) map.set(eodKey, pct);
  }

  for (const c of ce.corporateShareholders ?? []) {
    const corp = c as Record<string, unknown>;
    const { businessNumber, pct } = corporateBnAndPctOfSharesFromCe(corp);
    const key = normalizeId(businessNumber);
    if (pct === null) continue;
    if (key) map.set(key, pct);
    const codKey = normalizeId(String(corp.requestId ?? "").trim());
    if (codKey) map.set(codKey, pct);
  }

  return map;
}

/** Map keys: normalized IC/SSM when present, else normalized eodRequestId (RegTank often has no IC yet). */
export function lookupSharePctForAppRow(
  row: DirectorKycStatus,
  sharePctById: Map<string, number>
): number | null {
  const fromGov = normalizeId(row.governmentIdNumber);
  if (fromGov) {
    const v = sharePctById.get(fromGov);
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  const fromEod = normalizeId(String(row.eodRequestId ?? "").trim());
  if (!fromEod) return null;
  const v2 = sharePctById.get(fromEod);
  return typeof v2 === "number" && Number.isFinite(v2) ? v2 : null;
}

/** Keep app row in shareholder table: any Shareholder role unless known % is strictly under 5%. */
function appShareholderRoleShown(
  d: DirectorKycStatus,
  sharePctById: Map<string, number>
): boolean {
  const roleLower = String(d.role ?? "").toLowerCase();
  if (!roleLower.includes("shareholder")) return false;
  const sharePct = lookupSharePctForAppRow(d, sharePctById);
  if (typeof sharePct === "number" && sharePct < 5) return false;
  return true;
}

function appDirectorsFromKyc(directors: DirectorKycStatus[] | undefined): DirectorKycStatus[] {
  if (!directors?.length) return [];
  return directors.filter((d) => String(d.role ?? "").toLowerCase().includes("director"));
}

function appShareholdersFromKyc(
  directors: DirectorKycStatus[] | undefined,
  sharePctById: Map<string, number>
): DirectorKycStatus[] {
  if (!directors?.length) return [];
  return directors.filter((d) => appShareholderRoleShown(d, sharePctById));
}

function personNameFromCe(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const full = String(info?.fullName ?? "").trim();
  if (full) return full;
  const first = String(info?.firstName ?? "").trim();
  const last = String(info?.lastName ?? "").trim();
  return [first, last].filter(Boolean).join(" ").trim();
}

function issuerIcFromCeFormOnly(p: Record<string, unknown>): string | undefined {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  return extractGovernmentId(info?.formContent) ?? undefined;
}

function roleForCeShareholder(p: Record<string, unknown>): string {
  const pct = sharePctFromIndividualShareholderEntity(p);
  return (
    getDisplayRoleLabel({
      isDirector: false,
      isShareholder: true,
      sharePercentage: typeof pct === "number" ? pct : 0,
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
  const { businessNumber } = corporateBnAndPctOfSharesFromCe(corp);
  return businessNumber ?? undefined;
}

function corpShareholderPct(corp: Record<string, unknown>): number | null {
  return sharePctFromCorporateEntityDisplayAreas(corp);
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
  _directorKycStatus: OnboardingApplicationResponse["directorKycStatus"]
): DirectorKycStatus[] {
  void _directorKycStatus;
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
      governmentIdNumber: issuerIcFromCeFormOnly(p),
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
      governmentIdNumber: issuerIcFromCeFormOnly(p),
      lastUpdated: new Date(0).toISOString(),
    });
  }
  for (const c of ce.corporateShareholders ?? []) {
    const corp = c as Record<string, unknown>;
    const pct = corpShareholderPct(corp);
    const codRequestId = String(
      (corp.corporateOnboardingRequest as Record<string, unknown> | undefined)?.requestId ??
        corp.requestId ??
        ""
    ).trim();
    rows.push({
      eodRequestId: codRequestId || `ce-corp-${idx++}`,
      name: corpShareholderName(corp),
      email: "",
      role:
        pct !== null && Number.isFinite(pct)
          ? `Corporate Shareholder (${pct}%)`
          : "Corporate Shareholder",
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
  const sharePctById = buildSharePctMapFromCorporateEntities(application.corporateEntities);
  return {
    directors: appDirectorsFromKyc(kycList),
    shareholders: appShareholdersFromKyc(kycList, sharePctById),
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

/**
 * SECTION: CTOS equity_percentage → display %
 * WHY: Missing % keeps the row listed; callers must distinguish null from zero
 * OUTPUT: Percent 0–100+, or null if absent / invalid on the CTOS row
 */
export function ctosResolvedSharePctPercent(r: CtosOrgDirectorParsed): number | null {
  const raw = r.equity_percentage;
  if (raw == null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
}

/** Parse % from role like "Shareholder (35%)". Invalid → 0. */
export function shareholderPctFromAppRole(role: string): number {
  const m = /\(\s*([\d.]+%?)\s*\)/.exec(role);
  if (!m) return 0;
  const n = parseFloat(String(m[1]).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

/** Legacy naming: unknown CTOS equity → 0 — prefer ctosResolvedSharePctPercent when null matters. */
export function shareholderPctFromCtosRow(r: CtosOrgDirectorParsed): number {
  return ctosResolvedSharePctPercent(r) ?? 0;
}

function qualifiesCtosDirector(r: CtosOrgDirectorParsed): boolean {
  return isCtosDirectorTableRow(ctosPositionCode(r.position));
}

function qualifiesCtosShareholder(r: CtosOrgDirectorParsed): boolean {
  return isCtosShareholderTableRow(ctosPositionCode(r.position));
}

function qualifiesCtosShareholderListed(r: CtosOrgDirectorParsed): boolean {
  if (!qualifiesCtosShareholder(r)) return false;
  const pct = ctosResolvedSharePctPercent(r);
  if (pct === null) return true;
  return pct >= 5;
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
  const sharePctById = buildSharePctMapFromCorporateEntities(application.corporateEntities);
  const appDirList = appDirectorsFromKyc(kycList);
  const appShList = appShareholdersFromKyc(kycList, sharePctById);
  const appShFiltered = appShList;

  const ctosAll = ready && companyJson ? extractCtosOrgDirectorsFromCompanyJson(companyJson) : [];

  // Keep director/shareholder matching independent so DS/AS rows can appear in both sections.
  const dirPart = partitionPeople(appDirList, ctosAll, qualifiesCtosDirector, new Set<number>());
  const shPart = partitionPeople(appShFiltered, ctosAll, qualifiesCtosShareholderListed, new Set<number>());

  const directors: OnboardingPeopleBuckets = {
    matched: dirPart.matched,
    onlyApplication: onlyApplicationPeople(appDirList, dirPart.matched),
    onlyCtos: onlyCtosPeople(ctosAll, qualifiesCtosDirector, dirPart.matchedCtosIndices),
  };

  const shareholders: OnboardingPeopleBuckets = {
    matched: shPart.matched,
    onlyApplication: onlyApplicationPeople(appShFiltered, shPart.matched),
    onlyCtos: onlyCtosPeople(ctosAll, qualifiesCtosShareholderListed, shPart.matchedCtosIndices),
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
