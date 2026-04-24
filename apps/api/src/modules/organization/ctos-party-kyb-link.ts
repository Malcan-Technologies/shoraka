import { Prisma } from "@prisma/client";
import { normalizeDirectorShareholderIdKey } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { getRegTankAPIClient } from "../regtank/api-client";

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
      String(r.ic_lcno ?? "").trim() || String(r.nic_brno ?? "").trim() || null
    );
  }
  return null;
}

/** RegTank 4.9 vs 4.10: SO → shareholder; DO/AD/DS/AS → director (DS treated as director). */
function kybEndpointForCtosPosition(position: string | undefined): "director" | "shareholder" | null {
  const c = String(position ?? "").trim().toUpperCase();
  if (c === "SO") return "shareholder";
  if (c === "DO" || c === "AD" || c === "DS" || c === "AS") return "director";
  return null;
}

function findCtosPartyRow(
  companyJson: unknown,
  partyKeyNorm: string | null
): { endpoint: "director" | "shareholder"; percent?: number } | null {
  if (!partyKeyNorm) return null;
  const cj = companyJson as { directors?: unknown } | null | undefined;
  const raw = Array.isArray(cj?.directors) ? cj!.directors : [];
  for (const d of raw) {
    const r = d as CtosDirectorJson;
    if (ctosPartyKind(r) === "CORPORATE") continue;
    const mk = mergeKeyForCtosRow(r);
    if (mk !== partyKeyNorm) continue;
    const ep = kybEndpointForCtosPosition(String(r.position ?? ""));
    if (!ep) {
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
    return { endpoint: ep, percent: pct };
  }
  return null;
}

export type LinkCtosPartyToKybInput = {
  organizationId: string;
  partyKey: string;
  onboardingJson: Record<string, unknown>;
};

/**
 * After CTOS party KYC webhook sets regtankStatus APPROVED, attach KYC to org KYB (RegTank 4.9 / 4.10).
 * Idempotent via onboarding_json.kybLinked. Never throws (webhook must complete).
 */
export async function linkCtosPartyToKyb(input: LinkCtosPartyToKybInput): Promise<void> {
  const { organizationId, partyKey, onboardingJson } = input;
  if (onboardingJson.kybLinked === true) return;
  if (String(onboardingJson.regtankStatus ?? "").trim().toUpperCase() !== "APPROVED") return;

  const kyc = onboardingJson.kyc;
  const kycOb = kyc && typeof kyc === "object" && !Array.isArray(kyc) ? (kyc as Record<string, unknown>) : null;
  const kycId =
    kycOb && typeof kycOb.requestId === "string" && kycOb.requestId.trim() ? kycOb.requestId.trim() : "";
  if (!kycId) {
    logger.error(
      { organizationId, partyKey },
      "CTOS KYB link skipped: missing KYC requestId on onboarding_json.kyc"
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

  const api = getRegTankAPIClient();
  const remark = "CTOS party auto-link";

  try {
    if (match.endpoint === "director") {
      await api.addKybDirector({
        requestId: mainKybId,
        kycId,
        designation: "DIRECTOR",
        remark,
      });
    } else {
      await api.addKybIndividualShareholder({
        requestId: mainKybId,
        kycId,
        percentOfShare: match.percent,
        remark,
      });
    }
  } catch (e) {
    logger.error(
      {
        error: e instanceof Error ? e.message : String(e),
        organizationId,
        partyKey,
        mainKybId,
        kycId,
        endpoint: match.endpoint,
      },
      "CTOS KYB link RegTank API failed (non-blocking; will retry on next KYC webhook if applicable)"
    );
    return;
  }

  const nextJson = {
    ...onboardingJson,
    kybLinked: true,
    kybLinkedAt: new Date().toISOString(),
  };

  await prisma.ctosPartySupplement.update({
    where: {
      organization_id_party_key: {
        organization_id: organizationId,
        party_key: partyKey,
      },
    },
    data: { onboarding_json: nextJson as Prisma.InputJsonValue },
  });

  logger.info(
    {
      organizationId,
      partyKey,
      mainKybId,
      kycId,
      endpoint: match.endpoint,
    },
    "CTOS party linked to organization KYB via RegTank"
  );
}
