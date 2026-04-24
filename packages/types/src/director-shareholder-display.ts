/**
 * SECTION: Director / shareholder display rows
 * WHY: One source of truth for issuer profile, company-details step, and admin financial tab
 * INPUT: corporate_entities JSON, director_kyc_status JSON, optional organization CTOS company_json
 * OUTPUT: merged rows with strict IC/SSM matching when CTOS list is used
 * WHERE USED: apps/issuer, apps/admin (via @cashsouk/types)
 */

import { governmentIdFromDirectorKycForEod } from "./director-kyc-gov-id";

export type DirectorShareholderPartyType = "INDIVIDUAL" | "COMPANY";

export interface DirectorShareholderDisplayRow {
  id: string;
  name: string;
  role: string;
  type: DirectorShareholderPartyType;
  idNumber: string | null;
  registrationNumber: string | null;
  email: string;
  status: string;
  canEnterEmail: boolean;
  canSendOnboarding: boolean;
  /** Admin CTOS subject enquiry (IC / SSM / EOD). */
  enquiryId: string | null;
  subjectKind: "INDIVIDUAL" | "CORPORATE" | null;
}

export interface GetDirectorShareholderDisplayRowsInput {
  corporateEntities: unknown;
  directorKycStatus: unknown;
  organizationCtosCompanyJson?: unknown | null;
  /** Row ids (from this helper) marked as onboarding link sent (issuer UI only). */
  sentRowIds?: ReadonlySet<string> | null;
}

export function normalizeDirectorShareholderIdKey(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  return s.length ? s : null;
}

interface CtosOrgDirectorRow {
  ic_lcno: string | null;
  nic_brno: string | null;
  name: string | null;
  position: string | null;
  equity_percentage: number | null;
  equity: number | null;
  party_type: string | null;
}

const CTOS_POSITION_LABEL_BY_CODE: Record<string, string> = {
  DO: "Director",
  SO: "Shareholder",
  DS: "Director, Shareholder",
  AD: "Alternate Director",
  AS: "Alternate Director, Shareholder",
};

function extractCtosOrgDirectorsFromCompanyJson(companyJson: unknown): CtosOrgDirectorRow[] {
  const cj = companyJson as { directors?: unknown } | null | undefined;
  const raw = Array.isArray(cj?.directors) ? cj!.directors : [];
  const out: CtosOrgDirectorRow[] = [];
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

function primaryCtosIdFromDirectorRow(r: CtosOrgDirectorRow): string {
  const a = r.nic_brno != null ? String(r.nic_brno).trim() : "";
  const b = r.ic_lcno != null ? String(r.ic_lcno).trim() : "";
  return a || b;
}

function ctosPositionCanonicalCode(position: string | null | undefined): string | null {
  const p = String(position ?? "").trim().toUpperCase();
  if (p in CTOS_POSITION_LABEL_BY_CODE) return p;
  return null;
}

function roleLabelFromCtosOrgDirector(r: CtosOrgDirectorRow): string {
  const c = ctosPositionCanonicalCode(r.position);
  if (c && CTOS_POSITION_LABEL_BY_CODE[c]) return CTOS_POSITION_LABEL_BY_CODE[c];
  const p = (r.position ?? "").trim();
  return p || "Director";
}

function directorSubjectKindFromCtosOrgRow(r: CtosOrgDirectorRow): "INDIVIDUAL" | "CORPORATE" | null {
  if (r.party_type === "I") return "INDIVIDUAL";
  if (r.party_type === "C") return "CORPORATE";
  const nic = (r.nic_brno ?? "").trim();
  const ic = (r.ic_lcno ?? "").trim();
  if (nic && !ic) return "INDIVIDUAL";
  if (ic && !nic) return "CORPORATE";
  if (nic) return "INDIVIDUAL";
  if (ic) return "CORPORATE";
  return null;
}

function personNameFromCe(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const full = String(info?.fullName ?? "").trim();
  if (full) return full;
  const first = String(info?.firstName ?? "").trim();
  const last = String(info?.lastName ?? "").trim();
  const joined = [first, last].filter(Boolean).join(" ");
  return joined || "Unknown";
}

function emailFromCePerson(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const e = info?.email != null ? String(info.email).trim() : "";
  return e;
}

function issuerIcOrSsmFromCorpPerson(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const fromTop = String(info?.governmentIdNumber ?? "").trim();
  if (fromTop) return fromTop;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const idField = content.find((f) => f.fieldName === "Government ID Number");
  if (idField?.fieldValue) return String(idField.fieldValue).trim();
  return null;
}

function issuerIcOrSsmForCePersonRow(
  p: Record<string, unknown>,
  directorKycStatus: Record<string, unknown> | null | undefined
): string | null {
  const fromCe = issuerIcOrSsmFromCorpPerson(p);
  if (fromCe) return fromCe;
  const eod = String(p.eodRequestId ?? "").trim();
  return governmentIdFromDirectorKycForEod(directorKycStatus, eod);
}

function findKycStatusForEod(
  directorKycStatus: Record<string, unknown> | null | undefined,
  eod: string
): string | null {
  if (!eod) return null;
  const dirs = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  for (const d of dirs) {
    const primary = String(d.eodRequestId ?? "").trim();
    const shareholderEod = String(d.shareholderEodRequestId ?? "").trim();
    if ((primary === eod || shareholderEod === eod) && d.kycStatus) return String(d.kycStatus);
  }
  const sh = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of sh) {
    if (String(s.eodRequestId ?? "").trim() === eod && s.kycStatus) return String(s.kycStatus);
  }
  return null;
}

interface KycByIdEntry {
  email: string;
  status: string | null;
}

function buildKycByNormalizedId(directorKycStatus: Record<string, unknown> | null | undefined): Map<string, KycByIdEntry> {
  const m = new Map<string, KycByIdEntry>();
  const add = (rawId: unknown, email: unknown, status: unknown) => {
    const k = normalizeDirectorShareholderIdKey(rawId != null ? String(rawId) : null);
    if (!k) return;
    const em = email != null ? String(email).trim() : "";
    const st = status != null && String(status).trim() !== "" ? String(status) : null;
    if (!m.has(k)) m.set(k, { email: em, status: st });
  };
  const dirs = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  for (const d of dirs) {
    add(d.governmentIdNumber, d.email, d.kycStatus);
  }
  const sh = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of sh) {
    add(s.governmentIdNumber, s.email, s.kycStatus);
  }
  const biz = Array.isArray(directorKycStatus?.businessShareholders)
    ? (directorKycStatus!.businessShareholders as Record<string, unknown>[])
    : [];
  for (const b of biz) {
    add(
      b.businessRegistrationNumber ?? b.ssmNumber ?? b.companyRegistrationNumber,
      b.email,
      b.kybStatus ?? b.kycStatus
    );
  }
  return m;
}

function mergeRoleLabels(roles: Set<string>): string {
  const order = ["Director", "Shareholder", "Corporate Shareholder"];
  const parts: string[] = [];
  for (const o of order) {
    if (roles.has(o)) parts.push(o);
  }
  for (const r of roles) {
    if (!parts.includes(r)) parts.push(r);
  }
  return parts.join(", ");
}

function resolveIndividualStatus(
  icKey: string | null,
  eod: string | null,
  directorKycStatus: Record<string, unknown> | null | undefined,
  kycById: Map<string, KycByIdEntry>,
  ceStatus: string | null
): string {
  if (eod) {
    const st = findKycStatusForEod(directorKycStatus, eod);
    if (st) return st;
  }
  if (icKey) {
    const hit = kycById.get(icKey);
    if (hit?.status) return hit.status;
  }
  if (ceStatus) return ceStatus;
  return "Not requested";
}

function resolveCompanyStatus(
  regKey: string | null,
  kycById: Map<string, KycByIdEntry>,
  corp: Record<string, unknown>
): string {
  if (regKey) {
    const hit = kycById.get(regKey);
    if (hit?.status) return hit.status;
  }
  const st = corp.approveStatus ?? corp.status;
  if (st != null && String(st).trim() !== "") return String(st);
  return "Not requested";
}

function getCorpBusinessNumber(corp: Record<string, unknown>): string | null {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    const content = Array.isArray((area as Record<string, unknown>)?.content)
      ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
      : [];
    const numField = content.find((f) => f.fieldName === "Business Number");
    if (numField?.fieldValue) return String(numField.fieldValue).trim();
  }
  return null;
}

function getCorpDisplayName(corp: Record<string, unknown>): string {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  const basicInfo = displayAreas.find(
    (a: Record<string, unknown>) => a.displayArea === "Basic Information Setting"
  ) as { content?: Array<{ fieldName?: string; fieldValue?: string }> } | undefined;
  const content = Array.isArray(basicInfo?.content) ? basicInfo.content : [];
  const businessNameField = content.find((f) => f.fieldName === "Business Name");
  if (businessNameField?.fieldValue) return String(businessNameField.fieldValue);
  return String(corp.companyName || corp.businessName || "Unknown");
}

function hasUsableCtosDirectorList(companyJson: unknown): boolean {
  const list = extractCtosOrgDirectorsFromCompanyJson(companyJson);
  return list.length > 0;
}

function buildOnboardingDisplayRows(
  corporateEntities: Record<string, unknown> | null | undefined,
  directorKycStatus: Record<string, unknown> | null | undefined,
  sentRowIds: ReadonlySet<string> | null | undefined
): DirectorShareholderDisplayRow[] {
  const kycById = buildKycByNormalizedId(directorKycStatus);
  const directors = Array.isArray(corporateEntities?.directors)
    ? (corporateEntities!.directors as Record<string, unknown>[])
    : [];
  const shareholders = Array.isArray(corporateEntities?.shareholders)
    ? (corporateEntities!.shareholders as Record<string, unknown>[])
    : [];
  const corpShareholders = Array.isArray(corporateEntities?.corporateShareholders)
    ? (corporateEntities!.corporateShareholders as Record<string, unknown>[])
    : [];

  type IndBucket = {
    name: string;
    roles: Set<string>;
    email: string;
    icRaw: string | null;
    icKey: string | null;
    eod: string | null;
    ceStatus: string | null;
  };

  const indBuckets = new Map<string, IndBucket>();
  const indOrder: string[] = [];

  const bucketKeyForIndividual = (icKey: string | null, eod: string | null, idx: number): string => {
    if (icKey) return `I:${icKey}`;
    if (eod) return `I:EOD:${eod}`;
    return `I:IDX:${idx}`;
  };

  let idxCounter = 0;
  const findExistingIndKey = (icKey: string | null, eod: string | null): string | null => {
    for (const k of indOrder) {
      const b = indBuckets.get(k)!;
      if (icKey && b.icKey === icKey) return k;
      if (eod && b.eod === eod) return k;
    }
    return null;
  };

  const mergeInd = (key: string, patch: Partial<IndBucket> & { addRole?: string }) => {
    const cur = indBuckets.get(key)!;
    if (patch.addRole) cur.roles.add(patch.addRole);
    if (patch.name && patch.name !== "Unknown") cur.name = patch.name;
    if (patch.email && patch.email.trim()) cur.email = patch.email.trim();
    if (patch.icRaw && !cur.icRaw) cur.icRaw = patch.icRaw;
    if (patch.icKey && !cur.icKey) cur.icKey = patch.icKey;
    if (patch.eod && !cur.eod) cur.eod = patch.eod;
    if (patch.ceStatus && !cur.ceStatus) cur.ceStatus = patch.ceStatus;
  };

  const addInd = (icKey: string | null, eod: string | null, init: IndBucket) => {
    const existing = findExistingIndKey(icKey, eod);
    if (existing) {
      for (const r of init.roles) mergeInd(existing, { addRole: r });
      mergeInd(existing, {
        name: init.name,
        email: init.email,
        icRaw: init.icRaw,
        icKey: init.icKey,
        eod: init.eod,
        ceStatus: init.ceStatus,
      });
      return existing;
    }
    const key = bucketKeyForIndividual(icKey, eod, idxCounter++);
    indBuckets.set(key, init);
    indOrder.push(key);
    return key;
  };

  for (const p of directors) {
    const icRaw = issuerIcOrSsmForCePersonRow(p, directorKycStatus);
    const icKey = normalizeDirectorShareholderIdKey(icRaw);
    const eod = String(p.eodRequestId ?? "").trim() || null;
    const ceSt = (p.status ?? p.approveStatus) != null ? String(p.status ?? p.approveStatus) : null;
    const em = emailFromCePerson(p);
    addInd(icKey, eod, {
      name: personNameFromCe(p),
      roles: new Set(["Director"]),
      email: em,
      icRaw,
      icKey,
      eod,
      ceStatus: ceSt,
    });
  }

  for (const p of shareholders) {
    const icRaw = issuerIcOrSsmForCePersonRow(p, directorKycStatus);
    const icKey = normalizeDirectorShareholderIdKey(icRaw);
    const eod = String(p.eodRequestId ?? "").trim() || null;
    const ceSt = (p.status ?? p.approveStatus) != null ? String(p.status ?? p.approveStatus) : null;
    const em = emailFromCePerson(p);
    const existingKey = findExistingIndKey(icKey, eod);
    if (existingKey) {
      mergeInd(existingKey, {
        addRole: "Shareholder",
        name: personNameFromCe(p),
        email: em,
        icRaw,
        icKey,
        eod,
        ceStatus: ceSt,
      });
    } else {
      addInd(icKey, eod, {
        name: personNameFromCe(p),
        roles: new Set(["Shareholder"]),
        email: em,
        icRaw,
        icKey,
        eod,
        ceStatus: ceSt,
      });
    }
  }

  const rows: DirectorShareholderDisplayRow[] = [];

  for (const key of indOrder) {
    const b = indBuckets.get(key)!;
    const statusBase = resolveIndividualStatus(b.icKey, b.eod, directorKycStatus, kycById, b.ceStatus);
    const emailFromKyc = b.icKey ? kycById.get(b.icKey)?.email ?? "" : "";
    const email = (b.email && b.email.trim()) || emailFromKyc;
    const id = `onb-ind-${key}`;
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : statusBase;
    const canBase = !sent && (!email.trim() || statusBase === "Missing");
    rows.push({
      id,
      name: b.name,
      role: mergeRoleLabels(b.roles),
      type: "INDIVIDUAL",
      idNumber: b.icRaw,
      registrationNumber: null,
      email,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: b.icRaw ? b.icRaw.trim() : b.eod,
      subjectKind: "INDIVIDUAL",
    });
  }

  let corpIdx = 0;
  for (const corp of corpShareholders) {
    const regRaw = getCorpBusinessNumber(corp);
    const regKey = normalizeDirectorShareholderIdKey(regRaw);
    const id = `onb-corp-${regKey ?? corpIdx++}`;
    const statusBase = resolveCompanyStatus(regKey, kycById, corp);
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : statusBase;
    const email = "";
    const canBase = !sent && (!email.trim() || statusBase === "Missing");
    rows.push({
      id,
      name: getCorpDisplayName(corp),
      role: "Corporate Shareholder",
      type: "COMPANY",
      idNumber: null,
      registrationNumber: regRaw,
      email,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: regRaw ? regRaw.trim() : null,
      subjectKind: "CORPORATE",
    });
  }

  return rows;
}

function buildCtosBackedDisplayRows(
  companyJson: unknown,
  directorKycStatus: Record<string, unknown> | null | undefined,
  sentRowIds: ReadonlySet<string> | null | undefined
): DirectorShareholderDisplayRow[] {
  const kycById = buildKycByNormalizedId(directorKycStatus);
  const ctosList = extractCtosOrgDirectorsFromCompanyJson(companyJson);
  const rows: DirectorShareholderDisplayRow[] = [];
  let seq = 0;
  for (const cr of ctosList) {
    const primaryRaw = primaryCtosIdFromDirectorRow(cr);
    const idKey = normalizeDirectorShareholderIdKey(primaryRaw);
    const kind = directorSubjectKindFromCtosOrgRow(cr);
    const id = `ctos-${seq++}-${idKey ?? "noid"}`;
    const matched = idKey ? kycById.get(idKey) : undefined;
    const statusBase = !idKey ? "Missing" : matched?.status ? matched.status : "Missing";
    const email = matched?.email?.trim() ?? "";
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : statusBase;
    const party: DirectorShareholderPartyType = kind === "CORPORATE" ? "COMPANY" : "INDIVIDUAL";
    const idNumber = party === "INDIVIDUAL" ? (primaryRaw.trim() || null) : null;
    const registrationNumber = party === "COMPANY" ? (primaryRaw.trim() || null) : null;
    const canBase = !sent && (!email.trim() || statusBase === "Missing");
    rows.push({
      id,
      name: (cr.name ?? "").trim() || "Unknown",
      role: roleLabelFromCtosOrgDirector(cr),
      type: party,
      idNumber,
      registrationNumber,
      email,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: primaryRaw.trim() || null,
      subjectKind: kind,
    });
  }
  return rows;
}

function buildKycOnlyFallbackRows(
  directorKycStatus: Record<string, unknown> | null | undefined,
  sentRowIds: ReadonlySet<string> | null | undefined
): DirectorShareholderDisplayRow[] {
  const rows: DirectorShareholderDisplayRow[] = [];
  let idx = 0;
  const kycDirs = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  for (const d of kycDirs) {
    const roleStr = d.role ? String(d.role) : "";
    const isDir = roleStr.toLowerCase().includes("director");
    const isSh = roleStr.toLowerCase().includes("shareholder");
    const roles = new Set<string>();
    if (isDir) roles.add("Director");
    if (isSh) roles.add("Shareholder");
    if (roles.size === 0) roles.add("Director");
    const gid = d.governmentIdNumber != null ? String(d.governmentIdNumber).trim() : "";
    const gKey = normalizeDirectorShareholderIdKey(gid);
    const eod = String(d.eodRequestId ?? "").trim();
    const id = `kyc-only-${gKey ?? eod ?? `i${idx++}`}`;
    const stRaw = d.kycStatus != null ? String(d.kycStatus) : null;
    const statusBase = stRaw && stRaw.trim() !== "" ? stRaw : "Not requested";
    const em = d.email != null ? String(d.email).trim() : "";
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : statusBase;
    const canBase = !sent && (!em || statusBase === "Missing");
    rows.push({
      id,
      name: String(d.name || "Unknown"),
      role: mergeRoleLabels(roles),
      type: "INDIVIDUAL",
      idNumber: gid || null,
      registrationNumber: null,
      email: em,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: gid || eod || null,
      subjectKind: "INDIVIDUAL",
    });
  }
  const kycSh = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of kycSh) {
    const gid = s.governmentIdNumber != null ? String(s.governmentIdNumber).trim() : "";
    const gKey = normalizeDirectorShareholderIdKey(gid);
    const eod = String(s.eodRequestId ?? "").trim();
    const id = `kyc-sh-${gKey ?? eod ?? `s${idx++}`}`;
    const dup = rows.find((r) => gKey && normalizeDirectorShareholderIdKey(r.idNumber) === gKey);
    if (dup) continue;
    const stRaw = s.kycStatus != null ? String(s.kycStatus) : null;
    const statusBase = stRaw && stRaw.trim() !== "" ? stRaw : "Not requested";
    const em = s.email != null ? String(s.email).trim() : "";
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : statusBase;
    const canBase = !sent && (!em || statusBase === "Missing");
    rows.push({
      id,
      name: String(s.name || "Unknown"),
      role: "Shareholder",
      type: "INDIVIDUAL",
      idNumber: gid || null,
      registrationNumber: null,
      email: em,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: gid || eod || null,
      subjectKind: "INDIVIDUAL",
    });
  }
  return rows;
}

export function getDirectorShareholderDisplayRows(
  input: GetDirectorShareholderDisplayRowsInput
): DirectorShareholderDisplayRow[] {
  const corporateEntities = input.corporateEntities as Record<string, unknown> | null | undefined;
  const directorKycStatus = input.directorKycStatus as Record<string, unknown> | null | undefined;
  const sent = input.sentRowIds ?? null;
  const ctosJson = input.organizationCtosCompanyJson;

  if (hasUsableCtosDirectorList(ctosJson)) {
    return buildCtosBackedDisplayRows(ctosJson, directorKycStatus, sent);
  }

  const directors = Array.isArray(corporateEntities?.directors)
    ? (corporateEntities!.directors as Record<string, unknown>[])
    : [];
  const shareholders = Array.isArray(corporateEntities?.shareholders)
    ? (corporateEntities!.shareholders as Record<string, unknown>[])
    : [];
  const corp = Array.isArray(corporateEntities?.corporateShareholders)
    ? (corporateEntities!.corporateShareholders as Record<string, unknown>[])
    : [];

  if (directors.length > 0 || shareholders.length > 0 || corp.length > 0) {
    return buildOnboardingDisplayRows(corporateEntities, directorKycStatus, sent);
  }

  return buildKycOnlyFallbackRows(directorKycStatus, sent);
}
