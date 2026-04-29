import {
  normalizeDirectorShareholderIdKey,
  parseCtosPartySupplementRoot,
  getEffectiveCtosPartyScreening,
  getEffectiveCtosPartyOnboarding,
  getCtosPartySupplementFlatRead,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { extractCtosIndividuals } from "../regtank/helpers/detect-director-gaps";

type SupplementInput = {
  party_key?: string;
  partyKey?: string;
  onboarding_json?: unknown;
  onboardingJson?: unknown;
};

function screeningStatusFromSupplement(raw: unknown): string | null {
  const root = parseCtosPartySupplementRoot(raw);
  const scr = getEffectiveCtosPartyScreening(root);
  const s = scr.status;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

export function buildAdminPeopleList(params: {
  ctos: unknown;
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  /** Prefer {@link ctosPartySupplements} so every party row gets screening. */
  supplement?: unknown | null;
  ctosPartySupplements?: SupplementInput[] | null;
  corporateEntities: unknown;
}): ApplicationPersonRow[] {
  void params.corporateEntities;

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
  if (!ctosSafe) return [];

  const supplements: SupplementInput[] =
    Array.isArray(params.ctosPartySupplements) && params.ctosPartySupplements.length > 0
      ? params.ctosPartySupplements
      : params.supplement
        ? [params.supplement as SupplementInput]
        : [];

  const screeningByPartyKey = new Map<string, { status: string | null }>();
  const onboardingByPartyKey = new Map<string, { status: string | null }>();
  const userEmailByPartyKey = new Map<string, string>();
  for (const s of supplements) {
    const pk = normalizeDirectorShareholderIdKey(String(s.party_key ?? s.partyKey ?? ""));
    if (!pk) continue;
    const raw = s.onboarding_json ?? s.onboardingJson;
    const st = screeningStatusFromSupplement(raw);
    screeningByPartyKey.set(pk, { status: st });
    const root = parseCtosPartySupplementRoot(raw);
    const onboarding = getEffectiveCtosPartyOnboarding(root);
    const onboardingStatus = String(onboarding.status ?? onboarding.regtankStatus ?? "").trim() || null;
    onboardingByPartyKey.set(pk, { status: onboardingStatus });
    const flatEm = getCtosPartySupplementFlatRead(raw).email.trim();
    if (flatEm) userEmailByPartyKey.set(pk, flatEm);
  }

  const issuer = {
    director_kyc_status: params.issuerDirectorKycStatus ?? null,
    director_aml_status: params.issuerDirectorAmlStatus ?? null,
  };
  const businessShareholders = Array.isArray(
    (issuer.director_aml_status as { businessShareholders?: unknown } | null | undefined)
      ?.businessShareholders
  )
    ? ((issuer.director_aml_status as { businessShareholders?: unknown[] }).businessShareholders ?? [])
    : [];
  const corporateRawAmlByKey = new Map<string, string>();
  for (const shareholder of businessShareholders) {
    if (!shareholder || typeof shareholder !== "object" || Array.isArray(shareholder)) continue;
    const row = shareholder as Record<string, unknown>;
    const key = normalizeDirectorShareholderIdKey(
      String(
        row.businessNumber ??
          row.registrationNumber ??
          row.brn_ssm ??
          row.ic_lcno ??
          row.additional_registration_no ??
          ""
      )
    );
    if (!key) continue;
    corporateRawAmlByKey.set(
      key,
      typeof row.amlStatus === "string" ? row.amlStatus.trim() : ""
    );
  }

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
  const individualSyncAmlByGov = new Map<string, string>();
  const individualSyncAmlByKycId = new Map<string, string>();
  const individualSyncAmlByEod = new Map<string, string>();
  const individualAmlEmailByGov = new Map<string, string>();
  const individualAmlEmailByKycId = new Map<string, string>();
  const individualAmlEmailByNameKey = new Map<string, string>();
  for (const row of individualAmlRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const amlStatus = typeof r.amlStatus === "string" ? r.amlStatus.trim() : "";
    const gov = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? r.ic_lcno ?? ""));
    if (gov) individualSyncAmlByGov.set(gov, amlStatus);
    const kycId = String(r.kycId ?? "").trim();
    if (kycId) individualSyncAmlByKycId.set(kycId, amlStatus);
    const eod = String(r.eodRequestId ?? "").trim();
    if (eod) individualSyncAmlByEod.set(eod, amlStatus);

    const amlEm = String(r.email ?? "").trim();
    if (amlEm) {
      if (gov) individualAmlEmailByGov.set(gov, amlEm);
      if (kycId) individualAmlEmailByKycId.set(kycId, amlEm);
      const nm = String(r.name ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (nm) individualAmlEmailByNameKey.set(nm, amlEm);
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

  return Array.from(peopleMap.values()).map((person) => {
    const key = normalizeDirectorShareholderIdKey(person.matchKey) ?? "";
    const fromSup = key ? screeningByPartyKey.get(key) : undefined;
    const screeningStatus = fromSup?.status != null && String(fromSup.status).trim() !== ""
      ? String(fromSup.status).trim()
      : null;
    const screening: { status: string | null } = { status: screeningStatus };
    const amlLabel = screening.status?.trim() || "";
    const rawAmlSync =
      person.entityType === "CORPORATE"
        ? key
          ? corporateRawAmlByKey.get(key)
          : undefined
        : (() => {
            const kycRefs = key ? individualKycRefByGov.get(key) : undefined;
            return (
              (key ? individualSyncAmlByGov.get(key) : undefined) ||
              (kycRefs?.kycId ? individualSyncAmlByKycId.get(kycRefs.kycId) : undefined) ||
              (kycRefs?.eodRequestId ? individualSyncAmlByEod.get(kycRefs.eodRequestId) : undefined) ||
              (kycRefs?.shareholderEodRequestId
                ? individualSyncAmlByEod.get(kycRefs.shareholderEodRequestId)
                : undefined)
            );
          })();
    const directorAmlStatus =
      rawAmlSync != null && String(rawAmlSync).trim() !== "" ? String(rawAmlSync).trim() : null;
    const kycRefs = key ? individualKycRefByGov.get(key) : undefined;
    const directorKycStatus = kycRefs?.kycStatus?.trim()
      ? kycRefs.kycStatus.trim()
      : null;
    const onboardingStatus = key ? onboardingByPartyKey.get(key)?.status ?? null : null;

    const rawSaved = key ? userEmailByPartyKey.get(key) : undefined;
    const userEmail = rawSaved?.trim() ? rawSaved.trim() : null;

    let kycEmail: string | null = null;
    let amlEmail: string | null = null;
    if (person.entityType === "INDIVIDUAL") {
      kycEmail = kycRefs?.email?.trim() ? kycRefs.email.trim() : null;
      const amlByIc = key ? individualAmlEmailByGov.get(key) : undefined;
      if (amlByIc?.trim()) {
        amlEmail = amlByIc.trim();
      } else if (kycRefs?.kycId) {
        const amlByKyc = individualAmlEmailByKycId.get(kycRefs.kycId);
        if (amlByKyc?.trim()) amlEmail = amlByKyc.trim();
      }
      if (!amlEmail) {
        const nk = String(person.name ?? "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
        const amlByName = nk ? individualAmlEmailByNameKey.get(nk) : undefined;
        if (amlByName?.trim()) amlEmail = amlByName.trim();
      }
    }

    const email =
      (userEmail && userEmail.length > 0 ? userEmail : "") ||
      (kycEmail && kycEmail.length > 0 ? kycEmail : "") ||
      (amlEmail && amlEmail.length > 0 ? amlEmail : "") ||
      "";

    return {
      ...person,
      screening,
      directorAmlStatus,
      directorKycStatus,
      onboarding: { status: onboardingStatus },
      status: amlLabel,
      action: null,
      userEmail,
      kycEmail,
      amlEmail,
      email,
    };
  });
}
