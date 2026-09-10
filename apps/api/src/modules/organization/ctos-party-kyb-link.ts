import {
  OrganizationPartyEntityType,
  OrganizationPartyMembershipStatus,
  OrganizationPartyOrigin,
  Prisma,
} from "@prisma/client";
import {
  getCtosPartySupplementPipelineStatus,
  issuerShareholdingMeetsMinimum,
  isGeneratedUserPartyKey,
  normalizeDirectorShareholderIdKey,
  parseCtosPartySupplement,
  parseShareholdingPercent,
  sanitizeCtosPartySupplementOnboardingJsonForPersist,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { getRegTankAPIClient } from "../regtank/api-client";
import { ctosPositionDirectorShareholderFlags } from "../regtank/helpers/ctos-position-roles";

type PortalType = "issuer" | "investor";

type CtosDirectorJson = {
  ic_lcno?: unknown;
  nic_brno?: unknown;
  position?: unknown;
  party_type?: unknown;
  equity_percentage?: unknown;
  equity?: unknown;
};

type AssociationRoles = {
  isDirector: boolean;
  isShareholder: boolean;
  percent?: number;
};

function kybIdFromPayload(obj: unknown): string | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const dto = o.kybRequestDto;
  if (dto && typeof dto === "object" && !Array.isArray(dto)) {
    const k = (dto as Record<string, unknown>).kybId;
    if (typeof k === "string" && k.trim()) return k.trim();
  }
  if (typeof o.kybId === "string" && o.kybId.trim()) return o.kybId.trim();
  return null;
}

function corporateOnboardingWhere(portalType: PortalType, organizationId: string) {
  return portalType === "issuer"
    ? { issuer_organization_id: organizationId, onboarding_type: "CORPORATE" as const }
    : { investor_organization_id: organizationId, onboarding_type: "CORPORATE" as const };
}

function partyProfileWhere(portalType: PortalType, organizationId: string, partyKey: string) {
  return portalType === "issuer"
    ? { issuer_organization_id: organizationId, party_key: partyKey }
    : { investor_organization_id: organizationId, party_key: partyKey };
}

function supplementWhere(portalType: PortalType, organizationId: string, partyKey: string) {
  return portalType === "issuer"
    ? { issuer_organization_id: organizationId, party_key: partyKey }
    : { investor_organization_id: organizationId, party_key: partyKey };
}

function ctosReportWhere(portalType: PortalType, organizationId: string) {
  return portalType === "issuer"
    ? { issuer_organization_id: organizationId, company_json: { not: Prisma.JsonNull } }
    : { investor_organization_id: organizationId, company_json: { not: Prisma.JsonNull } };
}

/**
 * Parent company KYB id from the latest corporate RegTank onboarding payloads.
 */
export async function resolveOrganizationMainKybId(
  portalType: PortalType,
  organizationId: string
): Promise<string | null> {
  const rows = await prisma.regTankOnboarding.findMany({
    where: corporateOnboardingWhere(portalType, organizationId),
    orderBy: { updated_at: "desc" },
    take: 8,
    select: { webhook_payloads: true, regtank_response: true },
  });
  for (const row of rows) {
    const payloads = Array.isArray(row.webhook_payloads) ? row.webhook_payloads : [];
    for (let i = payloads.length - 1; i >= 0; i--) {
      const id = kybIdFromPayload(payloads[i]);
      if (id) return id;
    }
    const fromResp = kybIdFromPayload(row.regtank_response);
    if (fromResp) return fromResp;
  }
  return null;
}

function ctosPartyKind(r: CtosDirectorJson): "INDIVIDUAL" | "CORPORATE" | null {
  const pt = String(r.party_type ?? "").trim().toUpperCase();
  if (pt === "I") return "INDIVIDUAL";
  if (pt === "C") return "CORPORATE";
  const nic = String(r.nic_brno ?? "").trim();
  const ic = String(r.ic_lcno ?? "").trim();
  if (nic && !ic) return "INDIVIDUAL";
  if (ic && !nic) return "CORPORATE";
  if (nic) return "INDIVIDUAL";
  if (ic) return "CORPORATE";
  return null;
}

function mergeKeyForCtosRow(r: CtosDirectorJson): string | null {
  const kind = ctosPartyKind(r);
  if (kind === "CORPORATE") {
    return normalizeDirectorShareholderIdKey(
      String(r.nic_brno ?? "").trim() || String(r.ic_lcno ?? "").trim() || null
    );
  }
  if (kind === "INDIVIDUAL") {
    return normalizeDirectorShareholderIdKey(
      String(r.nic_brno ?? "").trim() || String(r.ic_lcno ?? "").trim() || null
    );
  }
  return null;
}

function findCtosPartyRow(
  companyJson: unknown,
  partyKeyNorm: string | null
): AssociationRoles | null {
  if (!partyKeyNorm) return null;
  const cj = companyJson as { directors?: unknown } | null | undefined;
  const raw = Array.isArray(cj?.directors) ? cj!.directors : [];
  for (const d of raw) {
    const r = d as CtosDirectorJson;
    if (ctosPartyKind(r) === "CORPORATE") continue;
    const mk = mergeKeyForCtosRow(r);
    if (mk !== partyKeyNorm) continue;
    const { isDirector, isShareholder } = ctosPositionDirectorShareholderFlags(String(r.position ?? ""));
    if (!isDirector && !isShareholder) {
      logger.warn(
        { partyKeyNorm, position: r.position },
        "CTOS KYB link skipped: unsupported CTOS position code for KYB add"
      );
      return null;
    }
    const pctRaw = r.equity_percentage ?? r.equity;
    const pct =
      typeof pctRaw === "number" && !Number.isNaN(pctRaw)
        ? pctRaw
        : typeof pctRaw === "string" && pctRaw.trim() !== "" && !Number.isNaN(Number(pctRaw))
          ? Number(pctRaw)
          : undefined;
    return { isDirector, isShareholder, percent: pct };
  }
  return null;
}

function directorKybLinked(ob: Record<string, unknown>): boolean {
  if (ob.kybDirectorLinked === true) return true;
  if (ob.kybLinked === true) return true;
  return false;
}

function shareholderKybLinked(ob: Record<string, unknown>): boolean {
  if (ob.kybShareholderLinked === true) return true;
  if (ob.kybLinked === true) return true;
  return false;
}

function stripLegacyKybFlags(ob: Record<string, unknown>): Record<string, unknown> {
  const next = { ...ob };
  delete next.kybLinked;
  delete next.kybLinkedAt;
  return next;
}

async function persistOnboardingJson(
  portalType: PortalType,
  organizationId: string,
  partyKey: string,
  json: Record<string, unknown>
): Promise<void> {
  const data = sanitizeCtosPartySupplementOnboardingJsonForPersist(stripLegacyKybFlags(json));
  const row = await prisma.ctosPartySupplement.findFirst({
    where: supplementWhere(portalType, organizationId, partyKey),
    select: { id: true },
  });
  if (!row) {
    logger.error(
      { organizationId, partyKey, portalType },
      "CTOS KYB persist skipped: no ctos_party_supplements row"
    );
    return;
  }
  await prisma.ctosPartySupplement.update({
    where: { id: row.id },
    data: { onboarding_json: data as Prisma.InputJsonValue },
  });
}

function rolesFromUserAddedParty(party: {
  entity_type: OrganizationPartyEntityType;
  membership_status: OrganizationPartyMembershipStatus;
  is_director: boolean;
  is_shareholder: boolean;
  shareholding_percentage: unknown;
}): AssociationRoles | null {
  if (party.membership_status !== OrganizationPartyMembershipStatus.MASTER_ACTIVE) {
    return null;
  }
  if (party.entity_type === OrganizationPartyEntityType.CORPORATE) {
    return { isDirector: false, isShareholder: false };
  }
  const percent = parseShareholdingPercent(party.shareholding_percentage) ?? undefined;
  const shareholderEligible = party.is_shareholder && issuerShareholdingMeetsMinimum(party.shareholding_percentage);
  return {
    isDirector: party.is_director === true,
    isShareholder: shareholderEligible,
    percent: shareholderEligible ? percent : undefined,
  };
}

async function resolveCtosAssociationRoles(
  portalType: PortalType,
  organizationId: string,
  partyKey: string
): Promise<AssociationRoles | null> {
  let partyKeyNorm = isGeneratedUserPartyKey(partyKey)
    ? null
    : normalizeDirectorShareholderIdKey(partyKey);
  if (isGeneratedUserPartyKey(partyKey)) {
    const party = await prisma.organizationPartyProfile.findFirst({
      where: partyProfileWhere(portalType, organizationId, partyKey),
      select: { identity_number: true },
    });
    partyKeyNorm = normalizeDirectorShareholderIdKey(party?.identity_number ?? null);
    if (!partyKeyNorm) {
      logger.info(
        { organizationId, partyKey, portalType },
        "CTOS KYB link skipped: pre-ID person has no identity_number yet"
      );
      return null;
    }
  }
  if (!partyKeyNorm) {
    logger.info(
      { organizationId, partyKey, portalType },
      "CTOS KYB link skipped: missing CTOS identity match key"
    );
    return null;
  }

  const report = await prisma.ctosReport.findFirst({
    where: ctosReportWhere(portalType, organizationId),
    orderBy: { fetched_at: "desc" },
    select: { company_json: true },
  });
  const match = findCtosPartyRow(report?.company_json ?? null, partyKeyNorm);
  if (!match) {
    logger.error(
      { organizationId, partyKey, partyKeyNorm, portalType },
      "CTOS KYB link skipped: party not found in latest CTOS company_json or is corporate/business"
    );
    return null;
  }
  return {
    isDirector: match.isDirector,
    isShareholder: match.isShareholder && issuerShareholdingMeetsMinimum(match.percent),
    percent: match.percent,
  };
}

async function resolveAssociationRoles(
  portalType: PortalType,
  organizationId: string,
  partyKey: string
): Promise<{ roles: AssociationRoles; remark: string } | null> {
  const party = await prisma.organizationPartyProfile.findFirst({
    where: partyProfileWhere(portalType, organizationId, partyKey),
    select: {
      origin: true,
      entity_type: true,
      membership_status: true,
      is_director: true,
      is_shareholder: true,
      shareholding_percentage: true,
    },
  });

  if (party?.origin === OrganizationPartyOrigin.USER_ADDED) {
    const roles = rolesFromUserAddedParty(party);
    if (!roles) {
      logger.info(
        { organizationId, partyKey, portalType, membership: party.membership_status },
        "KYB link skipped: USER_ADDED person is not an active individual for association"
      );
      return null;
    }
    return { roles, remark: "Company party auto-link" };
  }

  const ctosRoles = await resolveCtosAssociationRoles(portalType, organizationId, partyKey);
  if (!ctosRoles) return null;
  return { roles: ctosRoles, remark: "CTOS party auto-link" };
}

export type LinkCtosPartyToKybInput = {
  organizationId: string;
  partyKey: string;
  onboardingJson: Record<string, unknown>;
  portalType: PortalType;
};

/**
 * After party individual onboarding is APPROVED and a KYC ID exists, attach KYC to org KYB (RegTank 4.9 / 4.10).
 * USER_ADDED people use OrganizationPartyProfile roles. CTOS-derived people keep company_json matching.
 * Idempotent via kybDirectorLinked / kybShareholderLinked (legacy kybLinked counts as both).
 * Never throws (webhook must complete).
 */
export async function linkCtosPartyToKyb(input: LinkCtosPartyToKybInput): Promise<void> {
  const { organizationId, partyKey, onboardingJson, portalType } = input;
  if (getCtosPartySupplementPipelineStatus(onboardingJson).toUpperCase() !== "APPROVED") return;

  const scr = parseCtosPartySupplement(onboardingJson).screening;
  const kycId = scr?.requestId?.trim() ?? "";
  if (!kycId) {
    logger.error(
      { organizationId, partyKey, portalType },
      "CTOS KYB link skipped: missing KYC requestId on screening.requestId"
    );
    return;
  }

  const mainKybId = await resolveOrganizationMainKybId(portalType, organizationId);
  if (!mainKybId) {
    logger.error(
      { organizationId, partyKey, portalType },
      "CTOS KYB link skipped: could not resolve organization main KYB id from RegTank corporate onboarding"
    );
    return;
  }

  const resolved = await resolveAssociationRoles(portalType, organizationId, partyKey);
  if (!resolved) return;

  const { roles, remark } = resolved;
  const ob = onboardingJson as Record<string, unknown>;
  const directorDone = directorKybLinked(ob);
  const shareholderDone = shareholderKybLinked(ob);
  if ((!roles.isDirector || directorDone) && (!roles.isShareholder || shareholderDone)) {
    return;
  }

  let working = stripLegacyKybFlags({ ...onboardingJson });
  const api = getRegTankAPIClient();

  if (roles.isDirector && !directorKybLinked(working as Record<string, unknown>)) {
    try {
      await api.addKybDirector({
        requestId: mainKybId,
        kycId,
        designation: "DIRECTOR",
        remark,
      });
    } catch (e) {
      logger.error(
        {
          error: e instanceof Error ? e.message : String(e),
          organizationId,
          partyKey,
          portalType,
          mainKybId,
          kycId,
          step: "addKybDirector",
        },
        "CTOS KYB add director failed (non-blocking)"
      );
      return;
    }
    working = { ...working, kybDirectorLinked: true };
    await persistOnboardingJson(portalType, organizationId, partyKey, working);
    logger.info(
      { organizationId, partyKey, portalType, mainKybId, kycId, step: "addKybDirector" },
      "Party director role linked to organization KYB"
    );
  }

  if (roles.isShareholder && !shareholderKybLinked(working as Record<string, unknown>)) {
    try {
      await api.addKybIndividualShareholder({
        requestId: mainKybId,
        kycId,
        percentOfShare: roles.percent,
        remark,
      });
    } catch (e) {
      logger.error(
        {
          error: e instanceof Error ? e.message : String(e),
          organizationId,
          partyKey,
          portalType,
          mainKybId,
          kycId,
          step: "addKybIndividualShareholder",
        },
        "CTOS KYB add individual shareholder failed (non-blocking)"
      );
      return;
    }
    working = { ...working, kybShareholderLinked: true };
    await persistOnboardingJson(portalType, organizationId, partyKey, working);
    logger.info(
      { organizationId, partyKey, portalType, mainKybId, kycId, step: "addKybIndividualShareholder" },
      "Party shareholder role linked to organization KYB"
    );
  }
}
