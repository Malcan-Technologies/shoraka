import { Prisma } from "@prisma/client";
import {
  getCtosPartySupplementPipelineStatus,
  sanitizeCtosPartySupplementOnboardingJsonForPersist,
} from "@cashsouk/types";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { linkCtosPartyToKyb } from "../../modules/organization/ctos-party-kyb-link";

const FIVE_MIN_MS = 5 * 60 * 1000;

function asJsonRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function supplementPortal(
  row: { issuer_organization_id: string | null; investor_organization_id: string | null }
): { portalType: "issuer" | "investor"; organizationId: string } | null {
  if (row.issuer_organization_id) {
    return { portalType: "issuer", organizationId: row.issuer_organization_id };
  }
  if (row.investor_organization_id) {
    return { portalType: "investor", organizationId: row.investor_organization_id };
  }
  return null;
}

async function touchLastKybAttemptAt(
  portalType: "issuer" | "investor",
  organizationId: string,
  partyKey: string
): Promise<void> {
  const fresh = await prisma.ctosPartySupplement.findFirst({
    where:
      portalType === "issuer"
        ? { issuer_organization_id: organizationId, party_key: partyKey }
        : { investor_organization_id: organizationId, party_key: partyKey },
    select: { id: true, onboarding_json: true },
  });
  if (!fresh) return;
  const base = sanitizeCtosPartySupplementOnboardingJsonForPersist(
    asJsonRecord(fresh.onboarding_json) ?? {}
  );
  await prisma.ctosPartySupplement.update({
    where: { id: fresh.id },
    data: {
      onboarding_json: {
        ...base,
        lastKybAttemptAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Retries RegTank KYB attach (4.9 / 4.10) for parties that are KYC APPROVED but not fully linked.
 * Uses {@link linkCtosPartyToKyb} only; no duplicated role or API logic.
 */
export async function runCtosKybRetryJob(): Promise<void> {
  logger.info("Running CTOS KYB retry job");

  const rows = await prisma.ctosPartySupplement.findMany({
    where: {
      OR: [{ issuer_organization_id: { not: null } }, { investor_organization_id: { not: null } }],
    },
    select: {
      issuer_organization_id: true,
      investor_organization_id: true,
      party_key: true,
      onboarding_json: true,
    },
  });

  for (const row of rows) {
    try {
      const json = asJsonRecord(row.onboarding_json);
      if (!json) continue;

      if (getCtosPartySupplementPipelineStatus(json).toUpperCase() !== "APPROVED") continue;

      const directorDone = json.kybDirectorLinked === true || json.kybLinked === true;
      const shareholderDone = json.kybShareholderLinked === true || json.kybLinked === true;
      if (directorDone && shareholderDone) continue;

      const needsDirector = json.kybDirectorLinked !== true;
      const needsShareholder = json.kybShareholderLinked !== true;
      if (!needsDirector && !needsShareholder) continue;

      const lastRaw = json.lastKybAttemptAt;
      if (typeof lastRaw === "string" && lastRaw.trim()) {
        const t = new Date(lastRaw).getTime();
        if (!Number.isNaN(t) && Date.now() - t < FIVE_MIN_MS) continue;
      }

      const portal = supplementPortal(row);
      if (!portal) continue;

      logger.info(
        { partyKey: row.party_key, organizationId: portal.organizationId, portalType: portal.portalType },
        "Retrying CTOS KYB linking"
      );

      try {
        await linkCtosPartyToKyb({
          organizationId: portal.organizationId,
          partyKey: row.party_key,
          onboardingJson: json,
          portalType: portal.portalType,
        });
      } catch (e) {
        logger.error(
          {
            error: e instanceof Error ? e.message : String(e),
            partyKey: row.party_key,
            organizationId: portal.organizationId,
            portalType: portal.portalType,
          },
          "CTOS KYB retry linkCtosPartyToKyb threw (non-blocking)"
        );
      } finally {
        try {
          await touchLastKybAttemptAt(portal.portalType, portal.organizationId, row.party_key);
        } catch (e) {
          logger.error(
            {
              error: e instanceof Error ? e.message : String(e),
              partyKey: row.party_key,
              organizationId: portal.organizationId,
              portalType: portal.portalType,
            },
            "CTOS KYB retry lastKybAttemptAt update failed (non-blocking)"
          );
        }
      }
    } catch (e) {
      logger.error(
        {
          error: e instanceof Error ? e.message : String(e),
          partyKey: row.party_key,
        },
        "CTOS KYB retry row failed (non-blocking)"
      );
    }
  }
}
