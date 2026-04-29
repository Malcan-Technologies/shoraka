import {
  normalizeDirectorShareholderIdKey,
  parseCtosPartySupplementRoot,
  getEffectiveCtosPartyScreening,
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
  void params.issuerDirectorKycStatus;

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
  for (const s of supplements) {
    const pk = normalizeDirectorShareholderIdKey(String(s.party_key ?? s.partyKey ?? ""));
    if (!pk) continue;
    const raw = s.onboarding_json ?? s.onboardingJson;
    const st = screeningStatusFromSupplement(raw);
    screeningByPartyKey.set(pk, { status: st });
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

  const directorsAml = Array.isArray(
    (issuer.director_aml_status as { directors?: unknown } | null | undefined)?.directors
  )
    ? ((issuer.director_aml_status as { directors?: unknown[] }).directors ?? [])
    : [];
  const individualSyncAmlByKey = new Map<string, string>();
  for (const d of directorsAml) {
    if (!d || typeof d !== "object" || Array.isArray(d)) continue;
    const row = d as Record<string, unknown>;
    const gov = normalizeDirectorShareholderIdKey(String(row.governmentIdNumber ?? row.ic_lcno ?? ""));
    if (!gov) continue;
    individualSyncAmlByKey.set(
      gov,
      typeof row.amlStatus === "string" ? row.amlStatus.trim() : ""
    );
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
    let screening: { status: string | null } | null = null;
    if (person.entityType === "CORPORATE") {
      const fromSup = key ? screeningByPartyKey.get(key) : undefined;
      const fromSync = key ? corporateRawAmlByKey.get(key) : undefined;
      const st = (fromSup?.status != null && fromSup.status !== "" ? fromSup.status : null) ?? fromSync ?? null;
      screening = { status: st };
    } else {
      const fromSup = key ? screeningByPartyKey.get(key) : undefined;
      const fromSync = key ? individualSyncAmlByKey.get(key) : undefined;
      const st =
        (fromSup?.status != null && String(fromSup.status).trim() !== ""
          ? String(fromSup.status).trim()
          : null) ??
        (fromSync && fromSync.trim() !== "" ? fromSync : null);
      screening = { status: st };
    }
    const amlLabel = screening.status?.trim() || "—";
    return {
      ...person,
      screening,
      status: amlLabel,
      action: null,
    };
  });
}
