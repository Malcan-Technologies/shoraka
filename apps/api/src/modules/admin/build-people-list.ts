import type { OnboardingApplicationResponse } from "@cashsouk/types";
import { normalizeDirectorShareholderIdKey } from "@cashsouk/types";
import {
  detectDirectorGaps,
  extractCtosIndividuals,
} from "../regtank/helpers/detect-director-gaps";

export function buildAdminPeopleList(params: {
  ctos: unknown;
  issuerDirectorKycStatus: unknown;
  issuerDirectorAmlStatus: unknown;
  supplement: unknown;
  corporateEntities: unknown;
}): OnboardingApplicationResponse["people"] {
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

  const issuer = {
    director_kyc_status: params.issuerDirectorKycStatus ?? null,
    director_aml_status: params.issuerDirectorAmlStatus ?? null,
  };
  const gaps = detectDirectorGaps({
    ctos: ctosSafe,
    issuer,
    supplement: params.supplement,
  });
  const gapMap = new Map<string, "NEW_REQUIRED" | "IN_PROGRESS" | "KYC_INCOMPLETE" | "AML_INCOMPLETE">();
  gaps.amlIssues.forEach((x) => gapMap.set(x.matchKey, "AML_INCOMPLETE"));
  gaps.kycIssues.forEach((x) => gapMap.set(x.matchKey, "KYC_INCOMPLETE"));
  gaps.inProgress.forEach((x) => gapMap.set(x.matchKey, "IN_PROGRESS"));
  gaps.newRequired.forEach((x) => gapMap.set(x.matchKey, "NEW_REQUIRED"));

  const normalizeStatus = (value: unknown): string => {
    if (typeof value !== "string" || !value.trim()) return "NONE";
    return value.trim().replace(/_/g, " ").toUpperCase();
  };
  const businessShareholders = Array.isArray(
    (issuer.director_aml_status as { businessShareholders?: unknown } | null | undefined)
      ?.businessShareholders
  )
    ? ((issuer.director_aml_status as { businessShareholders?: unknown[] }).businessShareholders ?? [])
    : [];
  const corporateStatusMap = new Map<string, string>();
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
    corporateStatusMap.set(key, normalizeStatus(row.amlStatus));
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
      status: string | null;
      action: "SEND_EMAIL" | null;
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
        status: null,
        action: null,
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
  const people = Array.from(peopleMap.values()).map((person) => {
    const rawStatus =
      person.entityType === "CORPORATE"
        ? corporateStatusMap.get(person.matchKey) ?? null
        : gapMap.get(person.matchKey) ?? "APPROVED";
    const status = normalizeStatus(rawStatus ?? null);
    const action: "SEND_EMAIL" | null =
      person.entityType === "INDIVIDUAL" && status === "NEW REQUIRED" ? "SEND_EMAIL" : null;
    return {
      ...person,
      status,
      action,
    };
  });
  return people;
}
