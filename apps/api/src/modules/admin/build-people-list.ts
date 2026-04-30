import {
  normalizeDirectorShareholderIdKey,
  normalizeRawStatus,
  parseCtosPartySupplementRoot,
  getEffectiveCtosPartyScreening,
  getEffectiveCtosPartyOnboarding,
  getCtosPartySupplementFlatRead,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { getDirectorShareholderDisplayRows } from "@cashsouk/types";
import { extractCtosIndividuals } from "../regtank/helpers/detect-director-gaps";

type SupplementInput = {
  party_key?: string;
  partyKey?: string;
  onboarding_json?: unknown;
  onboardingJson?: unknown;
};

function buildSupplementOverrideMaps(supplements: SupplementInput[] | null | undefined): {
  onboardingByKey: Map<string, string | null>;
  screeningByKey: Map<string, string | null>;
  emailByKey: Map<string, string | null>;
} {
  const onboardingByKey = new Map<string, string | null>();
  const screeningByKey = new Map<string, string | null>();
  const emailByKey = new Map<string, string | null>();
  for (const s of supplements ?? []) {
    const key = normalizeDirectorShareholderIdKey(String(s.partyKey ?? s.party_key ?? ""));
    if (!key) continue;
    const raw = s.onboardingJson ?? s.onboarding_json;
    const root = parseCtosPartySupplementRoot(raw);
    const onboarding = getEffectiveCtosPartyOnboarding(root);
    const screening = getEffectiveCtosPartyScreening(root);
    const flat = getCtosPartySupplementFlatRead(raw);
    onboardingByKey.set(key, normalizeRawStatus(onboarding.status ?? onboarding.regtankStatus) || null);
    screeningByKey.set(key, normalizeRawStatus(screening.status) || null);
    emailByKey.set(key, flat.email.trim() || null);
  }
  return { onboardingByKey, screeningByKey, emailByKey };
}

function normalizeUnifiedPeopleRows(
  rows: ApplicationPersonRow[],
  supplements: SupplementInput[] | null | undefined
): ApplicationPersonRow[] {
  const { onboardingByKey, screeningByKey, emailByKey } = buildSupplementOverrideMaps(supplements);
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
      screening: existing.screening ?? row.screening ?? { status: null },
      onboarding: existing.onboarding ?? row.onboarding ?? { status: null },
      email: String(existing.email ?? row.email ?? "").trim(),
    });
  }

  return Array.from(merged.values()).map((row) => {
    const key = normalizeDirectorShareholderIdKey(row.matchKey) ?? row.matchKey;
    const roleSet = new Set<string>((row.roles ?? []).map((r) => String(r).toUpperCase()));
    const share = typeof row.sharePercentage === "number" ? row.sharePercentage : null;
    if (roleSet.has("SHAREHOLDER") && (share == null || share < 5)) roleSet.delete("SHAREHOLDER");
    const onboardingStatus = onboardingByKey.has(key) ? onboardingByKey.get(key) ?? null : normalizeRawStatus(row.onboarding?.status) || null;
    const screeningStatus = screeningByKey.has(key) ? screeningByKey.get(key) ?? null : normalizeRawStatus(row.screening?.status) || null;
    const email = emailByKey.has(key)
      ? emailByKey.get(key) ?? null
      : String(row.email ?? row.userEmail ?? row.kycEmail ?? row.amlEmail ?? "").trim() || null;
    return {
      ...row,
      matchKey: key,
      roles: Array.from(roleSet),
      onboarding: { status: onboardingStatus },
      screening: { status: screeningStatus },
      email: email ?? "",
      userEmail: undefined,
      kycEmail: undefined,
      amlEmail: undefined,
      directorAmlStatus: undefined,
      directorKycStatus: undefined,
    };
  });
}

function screeningStatusFromSupplement(raw: unknown): string | null {
  const root = parseCtosPartySupplementRoot(raw);
  const scr = getEffectiveCtosPartyScreening(root);
  const n = normalizeRawStatus(scr.status);
  return n || null;
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

  const baseRows = displayRows.map((r) => {
    // Admin UI expects matchKey to be the IC government id (INDIVIDUAL) or SSM number (CORPORATE).
    // We must not fall back to RegTank request ids here.
    const matchKey = (r.idNumber ?? r.registrationNumber ?? "") as string;

    const roles: Array<"DIRECTOR" | "SHAREHOLDER"> = [];
    if (r.isDirector) roles.push("DIRECTOR");

    // Preserve rule: <5% shareholders should not get the SHAREHOLDER role.
    const sharePct = typeof r.sharePercentage === "number" ? r.sharePercentage : null;
    if (r.isShareholder && sharePct != null && sharePct >= 5) roles.push("SHAREHOLDER");

    return {
      matchKey,
      name: r.name ?? null,
      entityType: (r.type === "INDIVIDUAL" ? "INDIVIDUAL" : "CORPORATE") as "INDIVIDUAL" | "CORPORATE",
      roles,
      sharePercentage: typeof r.sharePercentage === "number" ? r.sharePercentage : null,
      status: r.status ?? "",
      action: null,
      screening: { status: r.amlStatus ? normalizeRawStatus(r.amlStatus) : null },
      onboarding: { status: r.status ? normalizeRawStatus(r.status) : null },
      userEmail: null,
      kycEmail: r.email ?? null,
      amlEmail: null,
      email: r.email ?? "",
      directorAmlStatus: r.amlStatus ? normalizeRawStatus(r.amlStatus) : null,
      directorKycStatus: r.status ? normalizeRawStatus(r.status) : null,
    };
  });
  return normalizeUnifiedPeopleRows(baseRows, params.ctosPartySupplements ?? null);
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
    const onboardingNorm = normalizeRawStatus(onboarding.status ?? onboarding.regtankStatus);
    onboardingByPartyKey.set(pk, { status: onboardingNorm || null });
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
    const kycRefs = key ? individualKycRefByGov.get(key) : undefined;
    const rawAmlSync =
      person.entityType === "CORPORATE"
        ? (key ? corporateRawAmlByKey.get(key) : undefined)
        : (() => {
            return (
              (key ? individualSyncAmlByGov.get(key) : undefined) ||
              (kycRefs?.kycId ? individualSyncAmlByKycId.get(kycRefs.kycId) : undefined) ||
              (kycRefs?.eodRequestId ? individualSyncAmlByEod.get(kycRefs.eodRequestId) : undefined) ||
              (kycRefs?.shareholderEodRequestId
                ? individualSyncAmlByEod.get(kycRefs.shareholderEodRequestId)
                : undefined)
            );
          })();

    const hasDbMatch = Boolean(key) && Boolean(kycRefs || rawAmlSync || corporateRawAmlByKey.has(key));
    const hasSupplementMatch =
      Boolean(key) &&
      (onboardingByPartyKey.has(key) || screeningByPartyKey.has(key) || userEmailByPartyKey.has(key));
    const source: "EXISTING" | "ONBOARDING" | "NEW_PERSON" = hasDbMatch
      ? "EXISTING"
      : hasSupplementMatch
        ? "ONBOARDING"
        : "NEW_PERSON";

    let onboardingStatus: string | null = null;
    let screeningNorm: string | null = null;
    let userEmail: string | null = null;
    let kycEmail: string | null = null;
    let amlEmail: string | null = null;

    if (source === "ONBOARDING") {
      onboardingStatus = onboardingByPartyKey.get(key)?.status ?? null;
      screeningNorm = normalizeRawStatus(screeningByPartyKey.get(key)?.status) || null;
      const supEmail = userEmailByPartyKey.get(key);
      userEmail = supEmail?.trim() ? supEmail.trim() : null;
    } else if (source === "EXISTING") {
      onboardingStatus = kycRefs?.kycStatus?.trim() ? normalizeRawStatus(kycRefs.kycStatus.trim()) || null : null;
      screeningNorm =
        rawAmlSync != null && String(rawAmlSync).trim() !== ""
          ? normalizeRawStatus(String(rawAmlSync).trim()) || null
          : null;
      if (person.entityType === "INDIVIDUAL") {
        kycEmail = kycRefs?.email?.trim() ? kycRefs.email.trim() : null;
        const amlByIc = key ? individualAmlEmailByGov.get(key) : undefined;
        if (amlByIc?.trim()) {
          amlEmail = amlByIc.trim();
        } else if (kycRefs?.kycId) {
          const amlByKyc = individualAmlEmailByKycId.get(kycRefs.kycId);
          if (amlByKyc?.trim()) amlEmail = amlByKyc.trim();
        }
      }
    }

    const screening: { status: string | null } = { status: screeningNorm || null };
    const amlLabel = screeningNorm;
    const directorAmlStatus = screeningNorm;
    const directorKycStatus = onboardingStatus;
    const email =
      source === "ONBOARDING"
        ? userEmail ?? ""
        : source === "EXISTING"
          ? kycEmail ?? amlEmail ?? ""
          : "";

    console.log("RAW STATUS", {
      matchKey: person.matchKey,
      source,
      onboarding: onboardingStatus ?? "",
      screening: screeningNorm,
    });

    return {
      ...person,
      screening,
      directorAmlStatus,
      directorKycStatus,
      onboarding: { status: onboardingStatus },
      status: amlLabel || "",
      action: null,
      userEmail,
      kycEmail,
      amlEmail,
      email,
    };
  });
  return normalizeUnifiedPeopleRows(rawRows, null);
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
