import { Prisma } from "@prisma/client";
import {
  getCtosPartySupplementPipelineStatus,
  normalizeDirectorShareholderIdKey,
  parseCtosPartySupplement,
  sanitizeCtosPartySupplementOnboardingJsonForPersist,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { getRegTankAPIClient } from "../regtank/api-client";
import { ctosPositionDirectorShareholderFlags } from "../regtank/helpers/ctos-position-roles";

type CtosDirectorJson = {
  ic_lcno?: unknown;
  nic_brno?: unknown;
  position?: unknown;
  party_type?: unknown;
  equity_percentage?: unknown;
  equity?: unknown;
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

async function resolveIssuerOrganizationMainKybId(organizationId: string): Promise<string | null> {
  const rows = await prisma.regTankOnboarding.findMany({
    where: {
      issuer_organization_id: organizationId,
      onboarding_type: "CORPORATE",
    },
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
): { isDirector: boolean; isShareholder: boolean; percent?: number } | null {
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
  organizationId: string,
  partyKey: string,
  json: Record<string, unknown>
): Promise<void> {
  const data = sanitizeCtosPartySupplementOnboardingJsonForPersist(stripLegacyKybFlags(json));
  const row = await prisma.ctosPartySupplement.findFirst({
    where: { issuer_organization_id: organizationId, party_key: partyKey },
    select: { id: true },
  });
  if (!row) {
    logger.error(
      { organizationId, partyKey },
      "CTOS KYB persist skipped: no issuer ctos_party_supplements row"
    );
    return;
  }
  await prisma.ctosPartySupplement.update({
    where: { id: row.id },
    data: { onboarding_json: data as Prisma.InputJsonValue },
  });
}

export type LinkCtosPartyToKybInput = {
  organizationId: string;
  partyKey: string;
  onboardingJson: Record<string, unknown>;
};

/**
 * After CTOS party KYC webhook sets regtankStatus APPROVED, attach KYC to org KYB (RegTank 4.9 / 4.10).
 * DS/AS call both APIs when needed. Idempotent via kybDirectorLinked / kybShareholderLinked (legacy kybLinked counts as both).
 * Never throws (webhook must complete).
 */
export async function linkCtosPartyToKyb(input: LinkCtosPartyToKybInput): Promise<void> {
  const { organizationId, partyKey, onboardingJson } = input;
  if (getCtosPartySupplementPipelineStatus(onboardingJson).toUpperCase() !== "APPROVED") return;

  const scr = parseCtosPartySupplement(onboardingJson).screening;
  const kycId = scr?.requestId?.trim() ?? "";
  if (!kycId) {
    logger.error(
      { organizationId, partyKey },
      "CTOS KYB link skipped: missing KYC requestId on screening.requestId"
    );
    return;
  }

  const mainKybId = await resolveIssuerOrganizationMainKybId(organizationId);
  if (!mainKybId) {
    logger.error(
      { organizationId, partyKey },
      "CTOS KYB link skipped: could not resolve organization main KYB id from RegTank corporate onboarding"
    );
    return;
  }

  const partyKeyNorm = normalizeDirectorShareholderIdKey(partyKey);
  const report = await prisma.ctosReport.findFirst({
    where: {
      issuer_organization_id: organizationId,
      company_json: { not: Prisma.JsonNull },
    },
    orderBy: { fetched_at: "desc" },
    select: { company_json: true },
  });
  const match = findCtosPartyRow(report?.company_json ?? null, partyKeyNorm);
  if (!match) {
    logger.error(
      { organizationId, partyKey, partyKeyNorm },
      "CTOS KYB link skipped: party not found in latest CTOS company_json or is corporate/business"
    );
    return;
  }

  const ob = onboardingJson as Record<string, unknown>;
  const directorDone = directorKybLinked(ob);
  const shareholderDone = shareholderKybLinked(ob);
  if ((!match.isDirector || directorDone) && (!match.isShareholder || shareholderDone)) {
    return;
  }

  let working = stripLegacyKybFlags({ ...onboardingJson });

  const api = getRegTankAPIClient();
  const remark = "CTOS party auto-link";

  if (match.isDirector && !directorKybLinked(working as Record<string, unknown>)) {
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
          mainKybId,
          kycId,
          step: "addKybDirector",
        },
        "CTOS KYB add director failed (non-blocking)"
      );
      return;
    }
    working = { ...working, kybDirectorLinked: true };
    await persistOnboardingJson(organizationId, partyKey, working);
    logger.info(
      { organizationId, partyKey, mainKybId, kycId, step: "addKybDirector" },
      "CTOS party director role linked to organization KYB"
    );
  }

  if (match.isShareholder && !shareholderKybLinked(working as Record<string, unknown>)) {
    try {
      await api.addKybIndividualShareholder({
        requestId: mainKybId,
        kycId,
        percentOfShare: match.percent,
        remark,
      });
    } catch (e) {
      logger.error(
        {
          error: e instanceof Error ? e.message : String(e),
          organizationId,
          partyKey,
          mainKybId,
          kycId,
          step: "addKybIndividualShareholder",
        },
        "CTOS KYB add individual shareholder failed (non-blocking)"
      );
      return;
    }
    working = { ...working, kybShareholderLinked: true };
    await persistOnboardingJson(organizationId, partyKey, working);
    logger.info(
      { organizationId, partyKey, mainKybId, kycId, step: "addKybIndividualShareholder" },
      "CTOS party shareholder role linked to organization KYB"
    );
  }
}
