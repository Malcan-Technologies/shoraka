import {
  normalizeDirectorShareholderIdKey,
  normalizeRawStatus,
  parseCtosPartySupplement,
  extractBusinessNumber,
  extractGovernmentId,
  type ApplicationPersonRow,
  type CtosPartySupplement,
} from "@cashsouk/types";
import { getDirectorShareholderDisplayRows } from "@cashsouk/types";
import { extractCtosIndividuals } from "../regtank/helpers/detect-director-gaps";

type SupplementInput = {
  party_key?: string;
  partyKey?: string;
  onboarding_json?: unknown;
  onboardingJson?: unknown;
};

type UnknownRecord = Record<string, unknown>;

type CePartyRef = {
  eod: string | null;
  cod: string | null;
  kybId: string | null;
  kybStatusRaw: string | null;
};

type IssuerDirectorMaps = {
  kycByEod: Map<string, UnknownRecord>;
  kycByGov: Map<string, UnknownRecord>;
  amlByEod: Map<string, UnknownRecord>;
  amlByKycId: Map<string, UnknownRecord>;
  amlByGov: Map<string, UnknownRecord>;
  amlByCod: Map<string, UnknownRecord>;
  amlByBrn: Map<string, UnknownRecord>;
};

function strField(r: UnknownRecord | undefined, key: string): string {
  if (!r) return "";
  const v = r[key];
  return typeof v === "string" ? v.trim() : "";
}

function amlSanitizedStatus(row: UnknownRecord | undefined): string | null {
  const raw = strField(row, "amlStatus");
  return raw ? normalizeRawStatus(raw) || null : null;
}

function kycSanitizedStatus(row: UnknownRecord | undefined): string | null {
  const raw = strField(row, "kycStatus") || strField(row, "status");
  return raw ? normalizeRawStatus(raw) || null : null;
}

function screeningRiskFields(aml: UnknownRecord | undefined): {
  riskLevel: string | null;
  riskScore: string | number | null;
} {
  if (!aml) return { riskLevel: null, riskScore: null };
  const riskLevel = strField(aml, "amlRiskLevel") || strField(aml, "riskLevel") || null;
  const rs = aml.amlRiskScore ?? aml.riskScore;
  if (typeof rs === "number" && Number.isFinite(rs)) return { riskLevel, riskScore: rs };
  if (typeof rs === "string" && rs.trim()) return { riskLevel, riskScore: rs.trim() };
  return { riskLevel, riskScore: null };
}

function buildIssuerDirectorMaps(kycRoot: unknown, amlRoot: unknown): IssuerDirectorMaps {
  const kycByEod = new Map<string, UnknownRecord>();
  const kycByGov = new Map<string, UnknownRecord>();
  const amlByEod = new Map<string, UnknownRecord>();
  const amlByKycId = new Map<string, UnknownRecord>();
  const amlByGov = new Map<string, UnknownRecord>();
  const amlByCod = new Map<string, UnknownRecord>();
  const amlByBrn = new Map<string, UnknownRecord>();

  if (kycRoot && typeof kycRoot === "object" && !Array.isArray(kycRoot)) {
    const root = kycRoot as { directors?: unknown[]; individualShareholders?: unknown[] };
    const lists = [
      ...(Array.isArray(root.directors) ? root.directors : []),
      ...(Array.isArray(root.individualShareholders) ? root.individualShareholders : []),
    ];
    for (const row of lists) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as UnknownRecord;
      const eodP = strField(r, "eodRequestId");
      const eodS = strField(r, "shareholderEodRequestId");
      if (eodP) kycByEod.set(eodP, r);
      if (eodS) kycByEod.set(eodS, r);
      const gov = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? r.ic_lcno ?? ""));
      if (gov) kycByGov.set(gov, r);
    }
  }

  if (amlRoot && typeof amlRoot === "object" && !Array.isArray(amlRoot)) {
    const root = amlRoot as { directors?: unknown[]; individualShareholders?: unknown[]; businessShareholders?: unknown[] };
    const indLists = [
      ...(Array.isArray(root.directors) ? root.directors : []),
      ...(Array.isArray(root.individualShareholders) ? root.individualShareholders : []),
    ];
    for (const row of indLists) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as UnknownRecord;
      const eodPrimary = strField(r, "eodRequestId");
      const eodShareholder = strField(r, "shareholderEodRequestId");
      if (eodPrimary) amlByEod.set(eodPrimary, r);
      if (eodShareholder) amlByEod.set(eodShareholder, r);
      const kid = strField(r, "kycId");
      if (kid) amlByKycId.set(kid, r);
      const gov = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? r.ic_lcno ?? ""));
      if (gov) amlByGov.set(gov, r);
    }
    const biz = Array.isArray(root.businessShareholders) ? root.businessShareholders : [];
    for (const row of biz) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as UnknownRecord;
      const cod = strField(r, "codRequestId");
      if (cod) amlByCod.set(cod, r);
      const brn = normalizeDirectorShareholderIdKey(
        String(r.businessNumber ?? r.registrationNumber ?? r.brn_ssm ?? r.ic_lcno ?? r.additional_registration_no ?? "")
      );
      if (brn) amlByBrn.set(brn, r);
    }
  }

  return { kycByEod, kycByGov, amlByEod, amlByKycId, amlByGov, amlByCod, amlByBrn };
}

function buildCePartyRefs(corporateEntities: unknown): Map<string, CePartyRef> {
  const m = new Map<string, CePartyRef>();
  const merge = (rawKey: string | null | undefined, patch: Partial<CePartyRef>) => {
    const k = rawKey ? normalizeDirectorShareholderIdKey(rawKey) : "";
    if (!k) return;
    const prev = m.get(k) ?? { eod: null, cod: null, kybId: null, kybStatusRaw: null };
    m.set(k, {
      eod: prev.eod || patch.eod || null,
      cod: prev.cod || patch.cod || null,
      kybId: prev.kybId || patch.kybId || null,
      kybStatusRaw: prev.kybStatusRaw || patch.kybStatusRaw || null,
    });
  };

  if (!corporateEntities || typeof corporateEntities !== "object" || Array.isArray(corporateEntities)) return m;
  const ce = corporateEntities as UnknownRecord;

  const directors = Array.isArray(ce.directors) ? ce.directors : [];
  for (const p of directors) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const pr = p as UnknownRecord;
    const info = pr.personalInfo as UnknownRecord | undefined;
    const icRaw = extractGovernmentId(info?.formContent ?? pr.formContent);
    const icKey = icRaw ? normalizeDirectorShareholderIdKey(icRaw) : "";
    const eod = strField(pr, "eodRequestId") || null;
    merge(icKey || null, { eod });
  }

  const shareholders = Array.isArray(ce.shareholders) ? ce.shareholders : [];
  for (const p of shareholders) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const pr = p as UnknownRecord;
    const info = pr.personalInfo as UnknownRecord | undefined;
    const icRaw = extractGovernmentId(info?.formContent ?? pr.formContent);
    const icKey = icRaw ? normalizeDirectorShareholderIdKey(icRaw) : "";
    const eod = strField(pr, "eodRequestId") || null;
    merge(icKey || null, { eod });
  }

  const corporateShareholders = Array.isArray(ce.corporateShareholders) ? ce.corporateShareholders : [];
  for (const corp of corporateShareholders) {
    if (!corp || typeof corp !== "object" || Array.isArray(corp)) continue;
    const c = corp as UnknownRecord;
    const brnRaw = extractBusinessNumber(c.formContent);
    const ssmKey = brnRaw ? normalizeDirectorShareholderIdKey(brnRaw) : "";
    const corpOnb = c.corporateOnboardingRequest as UnknownRecord | undefined;
    const cod =
      strField(c, "codRequestId") ||
      strField(corpOnb ?? {}, "requestId") ||
      strField(c, "requestId") ||
      null;
    const kybDto = c.kybRequestDto as UnknownRecord | undefined;
    const kybId = strField(kybDto, "kybId") || strField(c, "kybId") || null;
    const kybSt = strField(kybDto, "status") || strField(c, "status") || null;
    merge(ssmKey || null, { cod: cod || null, kybId: kybId || null, kybStatusRaw: kybSt || null });
  }

  return m;
}

function readCeDocumentsUrls(pr: UnknownRecord): { front: string | null; back: string | null } {
  const docBlock =
    (pr.documents as UnknownRecord | undefined) ??
    ((pr.personalInfo as UnknownRecord | undefined)?.documents as UnknownRecord | undefined);
  if (!docBlock || typeof docBlock !== "object" || Array.isArray(docBlock)) {
    return { front: null, back: null };
  }
  const front = strField(docBlock, "frontDocumentUrl") || null;
  const back = strField(docBlock, "backDocumentUrl") || null;
  return { front, back };
}

/** IC front/back URLs keyed by normalized government id from CE directors + shareholders. */
function buildIcDocumentUrlsByMatchKey(corporateEntities: unknown): Map<string, { front: string | null; back: string | null }> {
  const m = new Map<string, { front: string | null; back: string | null }>();
  if (!corporateEntities || typeof corporateEntities !== "object" || Array.isArray(corporateEntities)) return m;
  const root = corporateEntities as UnknownRecord;
  const walk = (list: unknown[]) => {
    for (const p of list) {
      if (!p || typeof p !== "object" || Array.isArray(p)) continue;
      const pr = p as UnknownRecord;
      const info = pr.personalInfo as UnknownRecord | undefined;
      const icRaw = extractGovernmentId(info?.formContent ?? pr.formContent);
      const k = icRaw ? normalizeDirectorShareholderIdKey(icRaw) : "";
      if (!k) continue;
      const { front, back } = readCeDocumentsUrls(pr);
      const prev = m.get(k) ?? { front: null, back: null };
      m.set(k, {
        front: prev.front || front || null,
        back: prev.back || back || null,
      });
    }
  };
  walk(Array.isArray(root.directors) ? root.directors : []);
  walk(Array.isArray(root.shareholders) ? root.shareholders : []);
  return m;
}

function enrichPersonFromIssuerMaps(params: {
  entityType: "INDIVIDUAL" | "CORPORATE";
  matchKey: string;
  ce: CePartyRef | undefined;
  maps: IssuerDirectorMaps;
}): Pick<
  ApplicationPersonRow,
  "onboarding" | "screening" | "requestId" | "directorKycStatus" | "directorAmlStatus" | "status"
> {
  const key = normalizeDirectorShareholderIdKey(params.matchKey) ?? params.matchKey;
  const ce = params.ce;
  const maps = params.maps;

  if (params.entityType === "CORPORATE") {
    const cod = ce?.cod?.trim() || null;
    const aml = (cod ? maps.amlByCod.get(cod) : undefined) || maps.amlByBrn.get(key) || undefined;
    const amlSt = amlSanitizedStatus(aml);
    const { riskLevel, riskScore } = screeningRiskFields(aml);
    const kybSt = ce?.kybStatusRaw ? normalizeRawStatus(ce.kybStatusRaw) || null : null;
    const kybId = ce?.kybId?.trim() || null;
    const screening = {
      status: amlSt,
      id: cod || strField(aml, "codRequestId") || strField(aml, "requestId") || null,
      riskLevel,
      riskScore,
    };
    const onboarding = { status: kybSt, id: kybId || null };
    const kybFromAml = strField(aml, "kybId") || null;
    const requestId = kybId || kybFromAml || cod || null;
    return {
      onboarding,
      screening,
      requestId,
      directorKycStatus: kybSt,
      directorAmlStatus: amlSt,
      status: amlSt || "",
    };
  }

  const eodFromCe = ce?.eod?.trim() || null;
  const kycGov = maps.kycByGov.get(key);
  const eodFromKyc =
    strField(kycGov, "eodRequestId") || strField(kycGov, "shareholderEodRequestId") || null;
  const eod = eodFromCe || eodFromKyc || null;
  const kyc = (eod ? maps.kycByEod.get(eod) : undefined) || kycGov || undefined;
  const kycRow = (kyc ?? kycGov) as UnknownRecord | undefined;
  const kycIdForAml = strField(kycRow, "kycId");
  const aml =
    (eod ? maps.amlByEod.get(eod) : undefined) ||
    (kycIdForAml ? maps.amlByKycId.get(kycIdForAml) : undefined) ||
    maps.amlByGov.get(key) ||
    undefined;
  const kycSt = kycSanitizedStatus(kyc);
  const amlSt = amlSanitizedStatus(aml);
  const kycId = kycIdForAml ? kycIdForAml : null;
  const { riskLevel, riskScore } = screeningRiskFields(aml);
  const screening = {
    status: amlSt,
    id: strField(aml, "eodRequestId") || strField(aml, "requestId") || eod || null,
    riskLevel,
    riskScore,
  };
  const onboarding = { status: kycSt, id: kycId || null };
  const kycFromAml = strField(aml, "kycId") || null;
  const requestId = kycId || kycFromAml || eod || null;

  return {
    onboarding,
    screening,
    requestId,
    directorKycStatus: kycSt,
    directorAmlStatus: amlSt,
    status: amlSt || "",
  };
}

type SupplementParsed = { sup: CtosPartySupplement; raw: unknown };

function buildSupplementMapByMatchKey(supplements: SupplementInput[] | null | undefined): Map<string, SupplementParsed> {
  const m = new Map<string, SupplementParsed>();
  for (const s of supplements ?? []) {
    const key = normalizeDirectorShareholderIdKey(String(s.partyKey ?? s.party_key ?? ""));
    if (!key) continue;
    const raw = s.onboardingJson ?? s.onboarding_json;
    m.set(key, { sup: parseCtosPartySupplement(raw), raw });
  }
  return m;
}

function topLevelOnboardingRequestIdFromSupplementRaw(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const r = raw as Record<string, unknown>;
  return String(r.requestId ?? "").trim();
}

function requestIdFromSupplementParsed(sup: CtosPartySupplement, raw: unknown): {
  requestId: string | null;
  requestIdType: "SCREENING" | "ONBOARDING" | null;
} {
  const screeningId = String(sup.screening?.requestId ?? "").trim();
  const onboardingId = topLevelOnboardingRequestIdFromSupplementRaw(raw);
  if (screeningId) {
    return { requestId: screeningId, requestIdType: "SCREENING" };
  }
  if (onboardingId) {
    return { requestId: onboardingId, requestIdType: "ONBOARDING" };
  }
  return { requestId: null, requestIdType: null };
}

function screeningFromSupplementParsed(sc: CtosPartySupplement["screening"]): ApplicationPersonRow["screening"] {
  if (!sc) return null;
  const statusRaw = String(sc.status ?? "").trim();
  const statusNorm = statusRaw ? normalizeRawStatus(statusRaw) || statusRaw : null;
  const rid = String(sc.requestId ?? "").trim();
  if (!statusNorm && !rid && sc.riskLevel == null && sc.riskScore == null) return null;
  return {
    status: statusNorm,
    id: rid || null,
    riskLevel: sc.riskLevel ?? null,
    riskScore: sc.riskScore ?? null,
  };
}

function personRowFromSupplement(params: {
  matchKey: string;
  name: string | null;
  entityType: "INDIVIDUAL" | "CORPORATE";
  roles: Array<"DIRECTOR" | "SHAREHOLDER"> | string[];
  sharePercentage: number | null;
  sup: CtosPartySupplement;
  supplementRaw: unknown;
  icFrontUrl?: string | null;
  icBackUrl?: string | null;
}): ApplicationPersonRow {
  const screening = screeningFromSupplementParsed(params.sup.screening);
  const onboardingStatusRaw = String(params.sup.status ?? "").trim();
  const onboardingStatus = onboardingStatusRaw
    ? normalizeRawStatus(onboardingStatusRaw) || onboardingStatusRaw
    : null;
  const email = (params.sup.email ?? "").trim();
  const topStatus =
    screening?.status && String(screening.status).trim()
      ? normalizeRawStatus(String(screening.status)) || String(screening.status)
      : onboardingStatus
        ? normalizeRawStatus(onboardingStatus) || onboardingStatus
        : "";
  const { requestId, requestIdType } = requestIdFromSupplementParsed(params.sup, params.supplementRaw);
  return {
    matchKey: params.matchKey,
    name: params.name,
    entityType: params.entityType,
    roles: [...params.roles],
    sharePercentage: params.sharePercentage,
    status: topStatus,
    action: null,
    screening,
    onboarding: {
      status: onboardingStatus,
      id: params.sup.referenceId?.trim() || null,
      verifyLink: params.sup.verifyLink ?? null,
      updatedAt: params.sup.updatedAt ?? null,
    },
    requestId,
    requestIdType,
    icFrontUrl: params.icFrontUrl ?? null,
    icBackUrl: params.icBackUrl ?? null,
    email,
  };
}

function normalizeUnifiedPeopleRows(rows: ApplicationPersonRow[]): ApplicationPersonRow[] {
  const merged = new Map<string, ApplicationPersonRow>();
  for (const row of rows) {
    const key = normalizeDirectorShareholderIdKey(row.matchKey);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...row,
        matchKey: key,
        roles: [...(row.roles ?? [])],
      });
      continue;
    }
    const roleSet = new Set<string>([...(existing.roles ?? []), ...(row.roles ?? [])].map((r) => String(r).toUpperCase()));
    const existingShare = typeof existing.sharePercentage === "number" ? existing.sharePercentage : null;
    const incomingShare = typeof row.sharePercentage === "number" ? row.sharePercentage : null;
    merged.set(key, {
      ...existing,
      name: existing.name ?? row.name ?? null,
      roles: Array.from(roleSet),
      sharePercentage:
        existingShare != null && incomingShare != null ? Math.max(existingShare, incomingShare) : existingShare ?? incomingShare,
      screening: { ...(existing.screening ?? {}), ...(row.screening ?? {}) },
      onboarding: { ...(existing.onboarding ?? {}), ...(row.onboarding ?? {}) },
      requestId: existing.requestId ?? row.requestId ?? null,
      requestIdType: existing.requestIdType ?? row.requestIdType ?? null,
      icFrontUrl: existing.icFrontUrl ?? row.icFrontUrl ?? null,
      icBackUrl: existing.icBackUrl ?? row.icBackUrl ?? null,
      email: String(existing.email ?? row.email ?? "").trim(),
    });
  }

  const out = Array.from(merged.values()).map((row) => {
    const key = normalizeDirectorShareholderIdKey(row.matchKey) ?? row.matchKey;
    const roleSet = new Set<string>((row.roles ?? []).map((r) => String(r).toUpperCase()));
    const share = typeof row.sharePercentage === "number" ? row.sharePercentage : null;
    if (roleSet.has("SHAREHOLDER") && (share == null || share < 5)) roleSet.delete("SHAREHOLDER");
    const email = String(row.email ?? "").trim() || "";
    return {
      ...row,
      matchKey: key,
      roles: Array.from(roleSet),
      email,
      userEmail: undefined,
      kycEmail: undefined,
      amlEmail: undefined,
      directorAmlStatus: undefined,
      directorKycStatus: undefined,
    };
  });
  return out;
}

/**
 * SECTION: Build people from user-declared issuer data
 * WHY: CTOS can be missing; Admin UI still needs a non-empty director/shareholder list.
 * INPUT: issuer corporate_entities + director_kyc_status + director_aml_status (+ optional supplements)
 * OUTPUT: ApplicationPersonRow[] ready for Admin list/banner rendering
 * WHERE USED: apps/api admin buildAdminPeopleList when CTOS is unavailable
 */
function buildPeopleFromUserDeclaredData(params: {
  corporateEntities: unknown;
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  ctosPartySupplements?: SupplementInput[] | null;
}): ApplicationPersonRow[] {
  const mappedCtosPartySupplements: Array<{ partyKey: string; onboardingJson?: unknown }> | null =
    Array.isArray(params.ctosPartySupplements) && params.ctosPartySupplements.length > 0
      ? params.ctosPartySupplements
          .map((s) => {
            const partyKey = String(s.partyKey ?? s.party_key ?? "").trim();
            if (!partyKey) return null;
            const onboardingJson = s.onboardingJson ?? s.onboarding_json;
            if (onboardingJson === undefined) {
              return { partyKey };
            }
            return { partyKey, onboardingJson: onboardingJson as unknown };
          })
          .filter((x): x is { partyKey: string; onboardingJson?: unknown } => x !== null)
      : null;

  const displayRows = getDirectorShareholderDisplayRows({
    corporateEntities: params.corporateEntities,
    directorKycStatus: params.issuerDirectorKycStatus,
    directorAmlStatus: params.issuerDirectorAmlStatus,
    organizationCtosCompanyJson: null,
    ctosPartySupplements: mappedCtosPartySupplements ?? null,
    sentRowIds: null,
  });

  const issuerMaps = buildIssuerDirectorMaps(params.issuerDirectorKycStatus, params.issuerDirectorAmlStatus);
  const cePartyRefs = buildCePartyRefs(params.corporateEntities);
  const icDocsByMatchKey = buildIcDocumentUrlsByMatchKey(params.corporateEntities);
  const supplementByKey = buildSupplementMapByMatchKey(params.ctosPartySupplements);

  const baseRows = displayRows.map((r) => {
    // Admin UI expects matchKey to be the IC government id (INDIVIDUAL) or SSM number (CORPORATE).
    // We must not fall back to RegTank request ids here.
    const matchKey = (r.idNumber ?? r.registrationNumber ?? "") as string;
    const key = normalizeDirectorShareholderIdKey(matchKey) ?? matchKey;

    const roles: Array<"DIRECTOR" | "SHAREHOLDER"> = [];
    if (r.isDirector) roles.push("DIRECTOR");

    // Preserve rule: <5% shareholders should not get the SHAREHOLDER role.
    const sharePct = typeof r.sharePercentage === "number" ? r.sharePercentage : null;
    if (r.isShareholder && sharePct != null && sharePct >= 5) roles.push("SHAREHOLDER");

    const entityType = (r.type === "INDIVIDUAL" ? "INDIVIDUAL" : "CORPORATE") as "INDIVIDUAL" | "CORPORATE";
    const icUrls = entityType === "INDIVIDUAL" ? icDocsByMatchKey.get(key) : undefined;

    if (key && supplementByKey.has(key)) {
      const bundle = supplementByKey.get(key)!;
      return personRowFromSupplement({
        matchKey,
        name: r.name ?? null,
        entityType,
        roles,
        sharePercentage: typeof r.sharePercentage === "number" ? r.sharePercentage : null,
        sup: bundle.sup,
        supplementRaw: bundle.raw,
        icFrontUrl: icUrls?.front ?? null,
        icBackUrl: icUrls?.back ?? null,
      });
    }

    const enriched = enrichPersonFromIssuerMaps({
      entityType,
      matchKey,
      ce: cePartyRefs.get(key),
      maps: issuerMaps,
    });

    return {
      matchKey,
      name: r.name ?? null,
      entityType,
      roles,
      sharePercentage: typeof r.sharePercentage === "number" ? r.sharePercentage : null,
      status: enriched.status,
      action: null,
      screening: enriched.screening,
      onboarding: enriched.onboarding,
      requestId: enriched.requestId,
      icFrontUrl: icUrls?.front ?? null,
      icBackUrl: icUrls?.back ?? null,
      userEmail: null,
      kycEmail: r.email ?? null,
      amlEmail: null,
      email: r.email ?? "",
      directorAmlStatus: enriched.directorAmlStatus,
      directorKycStatus: enriched.directorKycStatus,
    };
  });

  const finalPeople = normalizeUnifiedPeopleRows(baseRows);
  // console.log(
  //   "[FINAL PEOPLE]",
  //   finalPeople.map((r) => ({
  //     entityType: r.entityType,
  //     matchKey: r.matchKey,
  //     roles: r.roles,
  //     sharePercentage: r.sharePercentage,
  //     requestId: r.requestId,
  //     screening: r.screening,
  //     onboarding: r.onboarding,
  //   }))
  // );
  // console.log(
  //   "[PERSON LINK]",
  //   finalPeople.map((p) => ({
  //     name: p.name,
  //     matchKey: p.matchKey,
  //     requestId: p.requestId,
  //     screening: p.screening,
  //     onboarding: p.onboarding,
  //   }))
  // );
  return finalPeople;
}

export function buildUnifiedPeople(params: {
  ctos: unknown;
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  /** Prefer {@link ctosPartySupplements} so every party row gets screening. */
  supplement?: unknown | null;
  ctosPartySupplements?: SupplementInput[] | null;
  corporateEntities: unknown;
}): ApplicationPersonRow[] {
  const ctos = params.ctos;
  const ctosSafe =
    ctos && typeof ctos === "object"
      ? {
          ...(ctos as Record<string, unknown>),
          directors: Array.isArray((ctos as { directors?: unknown }).directors)
            ? (ctos as { directors?: unknown[] }).directors
            : [],
          shareholders: Array.isArray((ctos as { shareholders?: unknown }).shareholders)
            ? (ctos as { shareholders?: unknown[] }).shareholders
            : [],
        }
      : null;

  if (!ctosSafe) {
    const organization = {
      corporateEntities: params.corporateEntities,
      issuerDirectorKycStatus: params.issuerDirectorKycStatus,
      issuerDirectorAmlStatus: params.issuerDirectorAmlStatus,
      ctosPartySupplements: params.ctosPartySupplements ?? null,
    };

    return buildPeopleFromUserDeclaredData(organization);
  }

  const supplements: SupplementInput[] =
    Array.isArray(params.ctosPartySupplements) && params.ctosPartySupplements.length > 0
      ? params.ctosPartySupplements
      : params.supplement
        ? [params.supplement as SupplementInput]
        : [];

  const supplementByKey = buildSupplementMapByMatchKey(supplements);

  const issuer = {
    director_kyc_status: params.issuerDirectorKycStatus ?? null,
    director_aml_status: params.issuerDirectorAmlStatus ?? null,
  };
  const issuerMaps = buildIssuerDirectorMaps(params.issuerDirectorKycStatus, params.issuerDirectorAmlStatus);
  const cePartyRefs = buildCePartyRefs(params.corporateEntities);
  const icDocsByMatchKey = buildIcDocumentUrlsByMatchKey(params.corporateEntities);

  const directorKycRoot =
    issuer.director_kyc_status && typeof issuer.director_kyc_status === "object" && !Array.isArray(issuer.director_kyc_status)
      ? (issuer.director_kyc_status as { directors?: unknown[]; individualShareholders?: unknown[] })
      : {};
  const individualKycRows = [
    ...(Array.isArray(directorKycRoot.directors) ? directorKycRoot.directors : []),
    ...(Array.isArray(directorKycRoot.individualShareholders) ? directorKycRoot.individualShareholders : []),
  ];
  const individualKycRefByGov = new Map<
    string,
    {
      kycId: string;
      eodRequestId: string;
      shareholderEodRequestId: string;
      kycStatus: string;
      email: string;
    }
  >();
  for (const row of individualKycRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const gov = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? r.ic_lcno ?? ""));
    if (!gov) continue;
    individualKycRefByGov.set(gov, {
      kycId: String(r.kycId ?? "").trim(),
      eodRequestId: String(r.eodRequestId ?? "").trim(),
      shareholderEodRequestId: String(r.shareholderEodRequestId ?? "").trim(),
      kycStatus: String(r.kycStatus ?? r.status ?? "").trim(),
      email: String(r.email ?? "").trim(),
    });
  }

  const directorAmlRoot =
    issuer.director_aml_status && typeof issuer.director_aml_status === "object" && !Array.isArray(issuer.director_aml_status)
      ? (issuer.director_aml_status as { directors?: unknown[]; individualShareholders?: unknown[] })
      : {};
  const individualAmlRows = [
    ...(Array.isArray(directorAmlRoot.directors) ? directorAmlRoot.directors : []),
    ...(Array.isArray(directorAmlRoot.individualShareholders) ? directorAmlRoot.individualShareholders : []),
  ];
  const individualAmlEmailByGov = new Map<string, string>();
  const individualAmlEmailByKycId = new Map<string, string>();
  for (const row of individualAmlRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const gov = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? r.ic_lcno ?? ""));
    const kycId = String(r.kycId ?? "").trim();
    const amlEm = String(r.email ?? "").trim();
    if (amlEm) {
      if (gov) individualAmlEmailByGov.set(gov, amlEm);
      if (kycId) individualAmlEmailByKycId.set(kycId, amlEm);
    }
  }

  const ctosPeople = extractCtosIndividuals(ctosSafe);

  const peopleMap = new Map<
    string,
    {
      matchKey: string;
      name: string | null;
      entityType: "INDIVIDUAL" | "CORPORATE";
      roles: Array<"DIRECTOR" | "SHAREHOLDER">;
      sharePercentage: number | null;
      status: string;
      action: "SEND_EMAIL" | null;
      screening: { status: string | null } | null;
    }
  >();
  for (const p of ctosPeople) {
    if (!p.matchKey) continue;
    const role = p.type === "DIRECTOR" || p.type === "SHAREHOLDER" ? p.type : "DIRECTOR";
    const incomingSharePercentage = typeof p.sharePercentage === "number" ? p.sharePercentage : null;
    if (role === "SHAREHOLDER" && (incomingSharePercentage === null || incomingSharePercentage < 5)) {
      continue;
    }
    if (!peopleMap.has(p.matchKey)) {
      peopleMap.set(p.matchKey, {
        matchKey: p.matchKey,
        name: p.name,
        entityType: p.entityType,
        roles: [role],
        sharePercentage: incomingSharePercentage,
        status: "",
        action: null,
        screening: null,
      });
      continue;
    }
    const existing = peopleMap.get(p.matchKey);
    if (!existing) continue;
    if (!existing.roles.includes(role)) {
      existing.roles.push(role);
    }
    if (incomingSharePercentage !== null) {
      existing.sharePercentage =
        existing.sharePercentage === null
          ? incomingSharePercentage
          : Math.max(existing.sharePercentage, incomingSharePercentage);
    }
    if (!existing.name && p.name) {
      existing.name = p.name;
    }
  }

  const rawRows = Array.from(peopleMap.values()).map((person) => {
    const key = normalizeDirectorShareholderIdKey(person.matchKey) ?? "";
    const icUrls = person.entityType === "INDIVIDUAL" ? icDocsByMatchKey.get(key) : undefined;

    if (key && supplementByKey.has(key)) {
      const bundle = supplementByKey.get(key)!;
      return personRowFromSupplement({
        matchKey: person.matchKey,
        name: person.name,
        entityType: person.entityType,
        roles: person.roles,
        sharePercentage: person.sharePercentage,
        sup: bundle.sup,
        supplementRaw: bundle.raw,
        icFrontUrl: icUrls?.front ?? null,
        icBackUrl: icUrls?.back ?? null,
      });
    }

    const kycRefs = key ? individualKycRefByGov.get(key) : undefined;
    const amlRow =
      person.entityType === "CORPORATE"
        ? key
          ? issuerMaps.amlByBrn.get(key)
          : undefined
        : key
          ? issuerMaps.amlByGov.get(key)
          : undefined;
    const hasDbMatch = Boolean(key && (kycRefs || amlSanitizedStatus(amlRow)));

    let kycEmail: string | null = null;
    let amlEmail: string | null = null;

    const enriched = enrichPersonFromIssuerMaps({
      entityType: person.entityType,
      matchKey: person.matchKey,
      ce: key ? cePartyRefs.get(key) : undefined,
      maps: issuerMaps,
    });

    const screeningFinal = enriched.screening;
    const onboardingFinal = enriched.onboarding;

    if (hasDbMatch && person.entityType === "INDIVIDUAL") {
      kycEmail = kycRefs?.email?.trim() ? kycRefs.email.trim() : null;
      const amlByIc = key ? individualAmlEmailByGov.get(key) : undefined;
      if (amlByIc?.trim()) {
        amlEmail = amlByIc.trim();
      } else if (kycRefs?.kycId) {
        const amlByKyc = individualAmlEmailByKycId.get(kycRefs.kycId);
        if (amlByKyc?.trim()) amlEmail = amlByKyc.trim();
      }
    }

    const email = hasDbMatch ? kycEmail ?? amlEmail ?? "" : "";

    return {
      ...person,
      screening: screeningFinal,
      directorAmlStatus: enriched.directorAmlStatus,
      directorKycStatus: enriched.directorKycStatus,
      onboarding: onboardingFinal,
      requestId: enriched.requestId,
      icFrontUrl: icUrls?.front ?? null,
      icBackUrl: icUrls?.back ?? null,
      status: screeningFinal?.status ? normalizeRawStatus(screeningFinal.status) || "" : enriched.status || "",
      action: null,
      userEmail: null,
      kycEmail,
      amlEmail,
      email,
    };
  });
  return normalizeUnifiedPeopleRows(rawRows);
}

export function buildAdminPeopleList(params: {
  ctos: unknown;
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  supplement?: unknown | null;
  ctosPartySupplements?: SupplementInput[] | null;
  corporateEntities: unknown;
}): ApplicationPersonRow[] {
  return buildUnifiedPeople(params);
}
