/**
 * SECTION: Director / shareholder display rows
 * WHY: One source of truth for issuer profile, company-details step, and admin financial tab
 * INPUT: corporate_entities JSON, director_kyc_status JSON, optional organization CTOS company_json
 * OUTPUT: merged rows (CTOS: one row per IC/SSM; onboarding: existing merge) with strict ID matching
 * WHERE USED: apps/issuer, apps/admin (via @cashsouk/types)
 */

import { governmentIdFromDirectorKycForEod } from "./director-kyc-gov-id";
import {
  effectiveCtosRegtankStatusFromOnboardingJson,
  mapRegtankStatusToDisplay,
} from "./regtank-onboarding-status";

export type DirectorShareholderPartyType = "INDIVIDUAL" | "COMPANY";

export interface DirectorShareholderDisplayRow {
  id: string;
  name: string;
  role: string;
  type: DirectorShareholderPartyType;
  idNumber: string | null;
  registrationNumber: string | null;
  /** Share ownership label, e.g. `10% ownership`, for application-flow layout. */
  ownershipDisplay: string | null;
  email: string;
  status: string;
  canEnterEmail: boolean;
  canSendOnboarding: boolean;
  /** Admin CTOS subject enquiry (IC / SSM / EOD). */
  enquiryId: string | null;
  subjectKind: "INDIVIDUAL" | "CORPORATE" | null;
  /** CTOS party: RegTank link sent (supplement.sent). Drives row chrome without overloading `status`. */
  ctosOnboardingLinkSent?: boolean;
  /** Raw internal RegTank status (reg_tank_onboarding semantics) when CTOS supplement exists. */
  ctosRegtankStatus?: string | null;
}

export interface CtosPartySupplementInput {
  partyKey: string;
  /** Persisted `ctos_party_supplements.onboarding_json` (email, sent, requestId, …). */
  onboardingJson?: unknown;
}

export interface GetDirectorShareholderDisplayRowsInput {
  corporateEntities: unknown;
  directorKycStatus: unknown;
  organizationCtosCompanyJson?: unknown | null;
  /** CTOS party supplements: party key + onboarding_json blob. */
  ctosPartySupplements?: ReadonlyArray<CtosPartySupplementInput> | null;
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

function parseCtosPartyOnboardingJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function buildSupplementDerivedMaps(supplements: ReadonlyArray<CtosPartySupplementInput> | null | undefined): {
  emailByPartyKey: Map<string, string>;
  sentPartyKeys: Set<string>;
  regtankStatusByPartyKey: Map<string, string>;
} {
  const emailByPartyKey = new Map<string, string>();
  const sentPartyKeys = new Set<string>();
  const regtankStatusByPartyKey = new Map<string, string>();
  if (!supplements?.length) return { emailByPartyKey, sentPartyKeys, regtankStatusByPartyKey };
  for (const row of supplements) {
    const k = normalizeDirectorShareholderIdKey(row.partyKey);
    if (!k) continue;
    const ob = parseCtosPartyOnboardingJson(row.onboardingJson);
    const em = ob.email != null ? String(ob.email).trim() : "";
    if (em) emailByPartyKey.set(k, em);
    if (ob.sent === true) sentPartyKeys.add(k);
    const rs = effectiveCtosRegtankStatusFromOnboardingJson(ob);
    if (rs) regtankStatusByPartyKey.set(k, rs);
  }
  return { emailByPartyKey, sentPartyKeys, regtankStatusByPartyKey };
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

/** IC / government id display for individual CTOS parties (prefer ic_lcno). */
function individualCtosIdDisplayRaw(r: CtosOrgDirectorRow): string {
  const ic = (r.ic_lcno ?? "").trim();
  const nic = (r.nic_brno ?? "").trim();
  return ic || nic;
}

/** SSM / registration display for corporate CTOS parties (prefer nic_brno). */
function corporateCtosRegDisplayRaw(r: CtosOrgDirectorRow): string {
  const ssm = (r.nic_brno ?? "").trim();
  const ic = (r.ic_lcno ?? "").trim();
  return ssm || ic;
}

/**
 * Normalized merge key for CTOS rows: same person → one bucket.
 * INDIVIDUAL → IC / gov id; COMPANY → SSM / registration (not name-based).
 */
function ctosPartyNormalizedMergeKey(
  r: CtosOrgDirectorRow,
  kind: "INDIVIDUAL" | "CORPORATE" | null
): string | null {
  if (kind === "INDIVIDUAL") {
    return normalizeDirectorShareholderIdKey(individualCtosIdDisplayRaw(r) || null);
  }
  if (kind === "CORPORATE") {
    return normalizeDirectorShareholderIdKey(corporateCtosRegDisplayRaw(r) || null);
  }
  return null;
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

function rolePartsFromCtosOrgDirector(r: CtosOrgDirectorRow): string[] {
  const label = roleLabelFromCtosOrgDirector(r);
  return label.split(",").map((s) => s.trim()).filter(Boolean);
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

function ownershipFromCePerson(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const shareField = content.find((f) => f.fieldName === "% of Shares");
  return shareField?.fieldValue ? `${shareField.fieldValue}% ownership` : null;
}

function ownershipFromCorpShareholder(corp: Record<string, unknown>): string | null {
  const formContent = corp.formContent as Record<string, unknown> | undefined;
  const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
  for (const area of displayAreas) {
    const content = Array.isArray((area as Record<string, unknown>)?.content)
      ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
      : [];
    const shareField = content.find((f) => f.fieldName === "% of Shares");
    if (shareField?.fieldValue) return `${shareField.fieldValue}% ownership`;
  }
  return null;
}

function ownershipFromCtosDirectorRow(r: CtosOrgDirectorRow): string | null {
  if (r.equity_percentage != null && !Number.isNaN(Number(r.equity_percentage))) {
    return `${r.equity_percentage}% ownership`;
  }
  if (r.equity != null && !Number.isNaN(Number(r.equity))) {
    return `${r.equity}% ownership`;
  }
  return null;
}

function ownershipFromKycRoleString(roleStr: string): string | null {
  const m = roleStr.match(/\((\d+)%\)/);
  return m ? `${m[1]}% ownership` : null;
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

export function hasUsableCtosDirectorList(companyJson: unknown): boolean {
  const list = extractCtosOrgDirectorsFromCompanyJson(companyJson);
  return list.length > 0;
}

function buildOnboardingDisplayRows(
  corporateEntities: Record<string, unknown> | null | undefined,
  directorKycStatus: Record<string, unknown> | null | undefined,
  sentRowIds: ReadonlySet<string> | null | undefined,
  supplementEmailByPartyKey: ReadonlyMap<string, string>
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
    ownershipDisplay: string | null;
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
    const po = patch.ownershipDisplay != null ? String(patch.ownershipDisplay).trim() : "";
    if (po && !cur.ownershipDisplay) cur.ownershipDisplay = patch.ownershipDisplay ?? null;
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
        ownershipDisplay: init.ownershipDisplay,
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
    const own = ownershipFromCePerson(p);
    addInd(icKey, eod, {
      name: personNameFromCe(p),
      roles: new Set(["Director"]),
      email: em,
      icRaw,
      icKey,
      eod,
      ceStatus: ceSt,
      ownershipDisplay: own,
    });
  }

  for (const p of shareholders) {
    const icRaw = issuerIcOrSsmForCePersonRow(p, directorKycStatus);
    const icKey = normalizeDirectorShareholderIdKey(icRaw);
    const eod = String(p.eodRequestId ?? "").trim() || null;
    const ceSt = (p.status ?? p.approveStatus) != null ? String(p.status ?? p.approveStatus) : null;
    const em = emailFromCePerson(p);
    const own = ownershipFromCePerson(p);
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
        ownershipDisplay: own,
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
        ownershipDisplay: own,
      });
    }
  }

  const rows: DirectorShareholderDisplayRow[] = [];

  for (const key of indOrder) {
    const b = indBuckets.get(key)!;
    const statusBase = resolveIndividualStatus(b.icKey, b.eod, directorKycStatus, kycById, b.ceStatus);
    const emailFromKyc = b.icKey ? kycById.get(b.icKey)?.email ?? "" : "";
    const fromSup = b.icKey ? supplementEmailByPartyKey.get(b.icKey) : undefined;
    const email =
      (fromSup && fromSup.trim()) || (b.email && b.email.trim()) || emailFromKyc;
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
      ownershipDisplay: b.ownershipDisplay,
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
    const fromSupCorp = regKey ? supplementEmailByPartyKey.get(regKey) : undefined;
    const email = (fromSupCorp && fromSupCorp.trim()) || "";
    const canBase = !sent && (!email.trim() || statusBase === "Missing");
    const corpOwn = ownershipFromCorpShareholder(corp);
    rows.push({
      id,
      name: getCorpDisplayName(corp),
      role: "Corporate Shareholder",
      type: "COMPANY",
      idNumber: null,
      registrationNumber: regRaw,
      ownershipDisplay: corpOwn,
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
  sentRowIds: ReadonlySet<string> | null | undefined,
  supplementEmailByPartyKey: ReadonlyMap<string, string>,
  supplementSentPartyKeys: ReadonlySet<string>,
  supplementRegtankStatusByPartyKey: ReadonlyMap<string, string>
): DirectorShareholderDisplayRow[] {
  const kycById = buildKycByNormalizedId(directorKycStatus);
  const ctosList = extractCtosOrgDirectorsFromCompanyJson(companyJson);

  type CtosMergedBucket = {
    roles: Set<string>;
    name: string;
    type: DirectorShareholderPartyType;
    idNumber: string | null;
    registrationNumber: string | null;
    enquiryId: string | null;
    subjectKind: "INDIVIDUAL" | "CORPORATE" | null;
    lookupKey: string | null;
    ownershipDisplay: string | null;
  };

  const merged = new Map<string, CtosMergedBucket>();
  const keyOrder: string[] = [];
  let anonSeq = 0;

  for (const cr of ctosList) {
    const kind = directorSubjectKindFromCtosOrgRow(cr);
    const lookupKey = ctosPartyNormalizedMergeKey(cr, kind);
    const mapKey = lookupKey ?? `__anon_${anonSeq++}`;

    const party: DirectorShareholderPartyType = kind === "CORPORATE" ? "COMPANY" : "INDIVIDUAL";
    const idDisp = individualCtosIdDisplayRaw(cr);
    const regDisp = corporateCtosRegDisplayRaw(cr);
    const parts = rolePartsFromCtosOrgDirector(cr);
    const own = ownershipFromCtosDirectorRow(cr);

    const existing = merged.get(mapKey);
    if (!existing) {
      merged.set(mapKey, {
        roles: new Set(parts),
        name: (cr.name ?? "").trim() || "Unknown",
        type: party,
        idNumber: party === "INDIVIDUAL" ? (idDisp || null) : null,
        registrationNumber: party === "COMPANY" ? (regDisp || null) : null,
        enquiryId: party === "INDIVIDUAL" ? (idDisp || null) : (regDisp || null),
        subjectKind: kind,
        lookupKey,
        ownershipDisplay: own,
      });
      keyOrder.push(mapKey);
    } else {
      for (const p of parts) existing.roles.add(p);
      const nm = (cr.name ?? "").trim();
      if (nm && (existing.name === "Unknown" || !existing.name.trim())) {
        existing.name = nm;
      }
      if (own && !existing.ownershipDisplay) {
        existing.ownershipDisplay = own;
      }
      if (existing.type === "INDIVIDUAL") {
        if (idDisp && !existing.idNumber?.trim()) {
          existing.idNumber = idDisp;
        }
        if (idDisp && !existing.enquiryId?.trim()) {
          existing.enquiryId = idDisp;
        }
      } else {
        if (regDisp && !existing.registrationNumber?.trim()) {
          existing.registrationNumber = regDisp;
        }
        if (regDisp && !existing.enquiryId?.trim()) {
          existing.enquiryId = regDisp;
        }
      }
    }
  }

  const rows: DirectorShareholderDisplayRow[] = [];
  let anonOut = 0;
  for (const mapKey of keyOrder) {
    const b = merged.get(mapKey)!;
    const idKeyNorm = b.lookupKey;
    const stableId = idKeyNorm ? `ctos-${idKeyNorm}` : `ctos-anon-${anonOut++}`;

    const matched = idKeyNorm ? kycById.get(idKeyNorm) : undefined;
    const statusBase = !idKeyNorm ? "Missing" : matched?.status ? matched.status : "Missing";
    const fromSupplement = idKeyNorm ? supplementEmailByPartyKey.get(idKeyNorm) : undefined;
    const kycEmail = matched?.email?.trim() ?? "";
    const email = (fromSupplement && fromSupplement.trim()) || kycEmail;
    const linkSent =
      Boolean(sentRowIds?.has(stableId)) ||
      Boolean(idKeyNorm && supplementSentPartyKeys.has(idKeyNorm));
    const rsRaw = idKeyNorm ? supplementRegtankStatusByPartyKey.get(idKeyNorm) : undefined;
    const status = linkSent ? mapRegtankStatusToDisplay(rsRaw ?? null) : statusBase;
    const canBase = !linkSent && (!email.trim() || statusBase === "Missing");
    const role = mergeRoleLabels(b.roles);

    rows.push({
      id: stableId,
      name: b.name,
      role,
      type: b.type,
      idNumber: b.idNumber,
      registrationNumber: b.registrationNumber,
      ownershipDisplay: b.ownershipDisplay,
      email,
      status,
      canEnterEmail: canBase,
      canSendOnboarding: canBase,
      enquiryId: b.enquiryId,
      subjectKind: b.subjectKind,
      ctosOnboardingLinkSent: linkSent,
      ctosRegtankStatus: rsRaw ?? null,
    });
  }
  return rows;
}

function buildKycOnlyFallbackRows(
  directorKycStatus: Record<string, unknown> | null | undefined,
  sentRowIds: ReadonlySet<string> | null | undefined,
  supplementEmailByPartyKey: ReadonlyMap<string, string>
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
    const fromSup = gKey ? supplementEmailByPartyKey.get(gKey) : undefined;
    const emKyc = d.email != null ? String(d.email).trim() : "";
    const em = (fromSup && fromSup.trim()) || emKyc;
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : statusBase;
    const canBase = !sent && (!em || statusBase === "Missing");
    const ownK = ownershipFromKycRoleString(roleStr);
    rows.push({
      id,
      name: String(d.name || "Unknown"),
      role: mergeRoleLabels(roles),
      type: "INDIVIDUAL",
      idNumber: gid || null,
      registrationNumber: null,
      ownershipDisplay: ownK,
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
    const fromSupS = gKey ? supplementEmailByPartyKey.get(gKey) : undefined;
    const emKycS = s.email != null ? String(s.email).trim() : "";
    const em = (fromSupS && fromSupS.trim()) || emKycS;
    const sent = Boolean(sentRowIds?.has(id));
    const status = sent ? "Sent" : statusBase;
    const canBase = !sent && (!em || statusBase === "Missing");
    const roleStrS = s.role ? String(s.role) : "";
    const ownS = ownershipFromKycRoleString(roleStrS);
    rows.push({
      id,
      name: String(s.name || "Unknown"),
      role: "Shareholder",
      type: "INDIVIDUAL",
      idNumber: gid || null,
      registrationNumber: null,
      ownershipDisplay: ownS,
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
  const {
    emailByPartyKey: supplementEmailByPartyKey,
    sentPartyKeys: supplementSentPartyKeys,
    regtankStatusByPartyKey: supplementRegtankStatusByPartyKey,
  } = buildSupplementDerivedMaps(input.ctosPartySupplements ?? null);

  if (hasUsableCtosDirectorList(ctosJson)) {
    return buildCtosBackedDisplayRows(
      ctosJson,
      directorKycStatus,
      sent,
      supplementEmailByPartyKey,
      supplementSentPartyKeys,
      supplementRegtankStatusByPartyKey
    );
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
    return buildOnboardingDisplayRows(corporateEntities, directorKycStatus, sent, supplementEmailByPartyKey);
  }

  return buildKycOnlyFallbackRows(directorKycStatus, sent, supplementEmailByPartyKey);
}
