/**
 * SECTION: CTOS vs onboarding application comparison (admin)
 * WHY: SSM/CTOS verification step shows Application vs CTOS columns and checklist
 * INPUT: onboarding application + optional CTOS company_json
 * OUTPUT: row models and checklist flags for the verification panel
 * WHERE USED: SSMVerificationPanel
 */

import type { DirectorKycStatus, OnboardingApplicationResponse } from "@cashsouk/types";

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
  companyStatus: OnboardingVerificationRow;
  businessType: OnboardingVerificationRow;
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
  const ctosStatus = cj?.status != null ? String(cj.status) : null;
  const ctosBiz = cj?.type_of_business != null ? String(cj.type_of_business) : null;

  const hasCtos = Boolean(companyJson && typeof companyJson === "object");

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

  const companyStatus: OnboardingVerificationRow = {
    appCell: "—",
    ctosCell: hasCtos ? (ctosStatus ?? "—") : null,
    match: hasCtos && (ctosStatus ?? "").toUpperCase().includes("ACTIVE"),
  };

  const businessType: OnboardingVerificationRow = {
    appCell: "—",
    ctosCell: hasCtos ? (ctosBiz ?? "—") : null,
    match: false,
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

  const appDirList = appDirectorsFromKyc(application.directorKycStatus?.directors);
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

  const appShList = appShareholdersFromKyc(application.directorKycStatus?.directors);
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
    { id: "dir", label: "Directors match CTOS (by ID)", ok: directorsMatch },
    { id: "sh", label: "Shareholders match CTOS (by ID and % where available)", ok: shareholdersMatch },
    { id: "active", label: "Company is ACTIVE in CTOS", ok: companyStatus.match },
  ];

  return {
    companyName,
    registration,
    companyStatus,
    businessType,
    directors,
    shareholders,
    checklist,
  };
}
