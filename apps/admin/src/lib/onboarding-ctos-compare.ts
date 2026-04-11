/**
 * SECTION: CTOS vs onboarding application comparison (admin)
 * WHY: SSM/CTOS verification compares application vs CTOS company_json
 * INPUT: onboarding application + optional CTOS company_json + fetch state
 * OUTPUT: name/SSM rows, director/shareholder rows, checklist (company + people name/ID checks)
 * WHERE USED: SSMVerificationPanel
 * NOTE: Company name match = trim + lowercase + single spaces, then exact equality. SSM = digits only.
 * Director/shareholder: match CTOS row by normalized IC/SSM key, then require same ID + same name (trim, case-insensitive).
 */

import {
  governmentIdFromDirectorKycForEod,
  type DirectorKycStatus,
  type OnboardingApplicationResponse,
} from "@cashsouk/types";

/** Org-level CTOS list: nothing loaded / loaded but unusable / ready to compare. */
export type OnboardingCtosOrgFetchState = "not_pulled" | "no_record" | "ready";

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
  /** Application IC / reg. no. (director & shareholder rows). */
  appIdDisplay?: string | null;
  /** CTOS extract IC / BRN (director & shareholder rows, when matched to a row). */
  ctosIdDisplay?: string | null;
}

export interface OnboardingCtosComparison {
  companyName: OnboardingVerificationRow;
  registration: OnboardingVerificationRow;
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

/** Trim, lowercase, collapse whitespace — for strict name equality. */
function normalizeComparableLabel(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function namesStrictMatch(appLabel: string, ctosName: string | null | undefined): boolean {
  const a = normalizeComparableLabel(appLabel === "—" ? "" : appLabel);
  const c = normalizeComparableLabel(ctosName);
  if (!a || !c) return false;
  return a === c;
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

function displayIdFromApp(governmentId: string | null | undefined): string | null {
  const s = String(governmentId ?? "").trim();
  return s || null;
}

function displayIdFromCtosRow(r: CtosOrgDirectorParsed): string | null {
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

function issuerCtosPersonNameAndIdMatch(d: DirectorKycStatus, ctosSide: CtosOrgDirectorParsed): boolean {
  const appId = normalizeIdKey(d.governmentIdNumber);
  const ctosId = normalizeIdKey(primaryCtosIdFromDirectorRow(ctosSide));
  if (!appId || !ctosId || appId !== ctosId) return false;
  const nameMatch =
    d.name.trim().toLowerCase() === String(ctosSide.name ?? "").trim().toLowerCase();
  return nameMatch;
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

/** For mock CTOS preview only — same director/shareholder split as the compare tables. */
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

function parseCtosNameReg(companyJson: unknown): { ctosName: string | null; ctosReg: string | null } {
  const cj = companyJson as Record<string, unknown> | null | undefined;
  if (!cj || typeof cj !== "object") return { ctosName: null, ctosReg: null };
  const ctosName = cj.name != null ? String(cj.name) : null;
  const ctosReg =
    cj.brn_ssm != null
      ? String(cj.brn_ssm)
      : cj.nic_brno != null
        ? String(cj.nic_brno)
        : cj.ic_lcno != null
          ? String(cj.ic_lcno)
          : null;
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

export function buildOnboardingCtosComparison(
  application: OnboardingApplicationResponse,
  companyJson: unknown | null,
  orgFetchState: OnboardingCtosOrgFetchState
): OnboardingCtosComparison {
  const appName = application.organizationName?.trim() || "—";
  const appReg = application.registrationNumber?.trim() || "—";

  const ready = orgFetchState === "ready";
  const { ctosName, ctosReg } = parseCtosNameReg(companyJson);

  const companyName: OnboardingVerificationRow = {
    appCell: appName,
    ctosCell: ready ? ctosName : null,
    match: ready && namesStrictMatch(appName, ctosName),
  };

  const registration: OnboardingVerificationRow = {
    appCell: appReg,
    ctosCell: ready ? (ctosReg?.trim() || null) : null,
    match: ready && registrationNumbersMatch(application.registrationNumber, ctosReg),
  };

  const ctosRows = ready && companyJson ? extractCtosOrgDirectorsFromCompanyJson(companyJson) : [];
  const ctosDirectorRows = ctosRows.filter((r) => isCtosDirectorTableRow(ctosPositionCode(r.position)));
  const ctosShareholderRows = ctosRows.filter((r) => isCtosShareholderTableRow(ctosPositionCode(r.position)));

  const ctosHasUsableSnapshot =
    companyJsonUsableForRegistryCompare(companyJson) ||
    ctosDirectorRows.length > 0 ||
    ctosShareholderRows.length > 0;

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
    const appIdDisplay = displayIdFromApp(d.governmentIdNumber);
    if (!ready) {
      return { appCell: d.name, ctosCell: null, match: false, appIdDisplay, ctosIdDisplay: null };
    }
    const k = normalizeIdKey(d.governmentIdNumber);
    const candidates = k ? ctosByKey.get(k) ?? [] : [];
    const ctosSide = candidates.find((c) => isCtosDirectorTableRow(ctosPositionCode(c.position)));
    const ctosCell = ctosSide ? (ctosSide.name ?? "").trim() || "—" : null;
    const match = ctosSide != null && issuerCtosPersonNameAndIdMatch(d, ctosSide);
    const ctosIdDisplay = ctosSide ? displayIdFromCtosRow(ctosSide) : null;
    return { appCell: d.name, ctosCell, match, appIdDisplay, ctosIdDisplay };
  });

  const appShList = appShareholdersFromKyc(kycList);
  const shareholders: OnboardingVerificationRow[] = appShList.map((d) => {
    const appIdDisplay = displayIdFromApp(d.governmentIdNumber);
    if (!ready) {
      return {
        appCell: d.name,
        ctosCell: null,
        match: false,
        appIdDisplay,
        ctosIdDisplay: null,
      };
    }
    const k = normalizeIdKey(d.governmentIdNumber);
    const candidates = k ? ctosByKey.get(k) ?? [] : [];
    const ctosSide = candidates.find((c) => isCtosShareholderTableRow(ctosPositionCode(c.position)));
    const ctosCell = ctosSide ? (ctosSide.name ?? "").trim() || "—" : null;
    const match = ctosSide != null && issuerCtosPersonNameAndIdMatch(d, ctosSide);
    const ctosIdDisplay = ctosSide ? displayIdFromCtosRow(ctosSide) : null;
    return { appCell: d.name, ctosCell, match, appIdDisplay, ctosIdDisplay };
  });

  const directorsMatch =
    !ready || !ctosHasUsableSnapshot
      ? false
      : appDirList.length === 0
        ? ctosDirectorRows.length === 0
        : directors.length > 0 && directors.every((r) => r.match);

  const shareholdersMatch =
    !ready || !ctosHasUsableSnapshot
      ? false
      : appShList.length === 0
        ? ctosShareholderRows.length === 0
        : shareholders.length > 0 && shareholders.every((r) => r.match);

  const checklist: { id: string; label: string; ok: boolean }[] = [
    { id: "name", label: "Company name matches", ok: companyName.match },
    { id: "reg", label: "Company SSM / reg. no. matches", ok: registration.match },
    {
      id: "dir",
      label: "Directors: name and IC / reg. no. match",
      ok: directorsMatch,
    },
    {
      id: "sh",
      label: "Shareholders: name and IC / reg. no. match",
      ok: shareholdersMatch,
    },
  ];

  if (process.env.NODE_ENV === "development") {
    console.log("[CTOS compare] application vs CTOS", {
      orgFetchState,
      ready,
      application: {
        organizationName: application.organizationName,
        registrationNumber: application.registrationNumber,
        directorRows: appDirList.length,
        shareholderRows: appShList.length,
      },
      ctos: {
        name: ctosName ?? null,
        registration: ctosReg ?? null,
        directorRowsInReport: ctosDirectorRows.length,
        shareholderRowsInReport: ctosShareholderRows.length,
        hasUsableSnapshot: ctosHasUsableSnapshot,
      },
      rowMatchFlags: {
        companyName: companyName.match,
        registration: registration.match,
      },
      checklist: checklist.map((c) => ({ id: c.id, ok: c.ok, label: c.label })),
    });
  }

  return {
    companyName,
    registration,
    directors,
    shareholders,
    checklist,
  };
}
