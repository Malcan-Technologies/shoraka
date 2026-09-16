import type { Prisma } from "@prisma/client";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { mergeCtosPartySupplementDocument } from "@cashsouk/types";
import { RegTankAPIClient } from "../regtank/api-client";
import { RegTankRefreshSession, RegTankRefreshClient } from "../regtank/helpers/regtank-refresh-session";
import { AppError } from "../../lib/http/error-handler";
import { isRegTankRateLimited, REGTANK_RATE_LIMITED_CODE } from "../regtank/helpers/regtank-rate-limit";
import { REFRESH_IN_PROGRESS_CODE } from "../regtank/helpers/regtank-refresh-lock";

// Reusable provider-query + CTOS persist logic for People & Access party rows.
// Caller decides *whether* to sync (locks, rate-limits, gating, permissions).

type Portal = "issuer" | "investor";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractRegTankStatus(body: unknown): string {
  const row = Array.isArray(body) ? body[0] : body;
  if (!isRecord(row)) return "";
  if (typeof row.status === "string" && row.status.trim()) return row.status.trim();
  for (const key of ["corporateIndividualRequest", "corporateOnboardingRequest", "corporateRequest"]) {
    const nested = row[key];
    if (isRecord(nested) && typeof nested.status === "string" && nested.status.trim()) {
      return nested.status.trim();
    }
  }
  return "";
}

export function extractRegTankScreeningPatch(
  body: unknown,
  requestId: string
): Record<string, unknown> | null {
  const status = extractRegTankStatus(body);
  const id = requestId.trim();
  if (!status || !id) return null;
  const row = Array.isArray(body) ? body[0] : body;
  const patch: Record<string, unknown> = {
    requestId: id,
    status,
    provider: "REGTANK",
    updatedAt: new Date().toISOString(),
  };
  if (isRecord(row)) {
    if (row.riskLevel != null) patch.riskLevel = row.riskLevel;
    if (row.riskScore != null) patch.riskScore = row.riskScore;
    if (row.messageStatus != null) patch.messageStatus = row.messageStatus;
  }
  return patch;
}

export type SyncCtosPartyRegTankInput = {
  portal: Portal;
  organizationId: string;
  partyKey: string;
  /** LD request id for individual onboarding. */
  individualOnboardingRequestId: string | null;
  /** EOD request id for entity onboarding. */
  entityOnboardingRequestId: string | null;
  /** COD request id for corporate onboarding. */
  corporateOnboardingRequestId: string | null;
  /** KYC screening id (usually "KYC..."). */
  kycId: string | null;
  /** KYB screening id (usually "KYB..."). */
  kybId: string | null;
  regTankClient?: RegTankRefreshClient;
};

export type SyncCtosPartyRegTankResult = {
  refreshedSources: string[];
};

function isString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function findKycIdFromOnboardingDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const rec = details as Record<string, unknown>;
  const raw =
    rec.kycId ??
    rec.kyc_id ??
    rec.kycID ??
    (rec.kyc && typeof rec.kyc === "object" ? (rec.kyc as Record<string, unknown>).kycId : null);
  return isString(raw) ? raw.trim() : null;
}

function friendlyRateLimitError(): AppError {
  return new AppError(429, REGTANK_RATE_LIMITED_CODE, "Status was refreshed recently. Please wait a moment and try again.");
}

function rethrowControlError(error: unknown): void {
  if (error instanceof AppError && error.code === REFRESH_IN_PROGRESS_CODE) {
    throw new AppError(429, REGTANK_RATE_LIMITED_CODE, "Status was refreshed recently. Please wait a moment and try again.");
  }
  if (isRegTankRateLimited(error)) {
    throw friendlyRateLimitError();
  }
}

async function getOrCreateCtosPartySupplementBase(
  portal: Portal,
  organizationId: string,
  partyKey: string,
  db: typeof prisma | Prisma.TransactionClient
): Promise<{ id: string | null; onboardingJson: unknown }> {
  const existing = await db.ctosPartySupplement.findFirst({
    where:
      portal === "issuer"
        ? { issuer_organization_id: organizationId, party_key: partyKey }
        : { investor_organization_id: organizationId, party_key: partyKey },
  });
  return { id: existing?.id ?? null, onboardingJson: existing?.onboarding_json ?? null };
}

export async function syncCtosPartyRegTankStatus(
  input: SyncCtosPartyRegTankInput
): Promise<SyncCtosPartyRegTankResult> {
  const { portal, organizationId, partyKey } = input;
  const regTankClient = input.regTankClient ?? new RegTankAPIClient();
  const session = new RegTankRefreshSession(regTankClient);

  const refreshedSources: string[] = [];
  let regtankPipelineStatus: string | null = null;

  // 1) Live onboarding pipeline status
  let individualDetails: unknown | null = null;

  const maybeQuery = async <T,>(label: string, load: () => Promise<T>): Promise<T | null> => {
    try {
      return await load();
    } catch (error) {
      rethrowControlError(error);
      logger.warn(
        {
          portal,
          organizationId,
          partyKey,
          source: label,
          error: error instanceof Error ? error.message : String(error),
        },
        "RegTank party sync query failed"
      );
      return null;
    }
  };

  if (input.individualOnboardingRequestId) {
    individualDetails = await maybeQuery("INDIVIDUAL_ONBOARDING", () =>
      session.queryOnboardingDetails(input.individualOnboardingRequestId!)
    );
    if (individualDetails) {
      const next = extractRegTankStatus(individualDetails);
      if (next) {
        regtankPipelineStatus = next;
        refreshedSources.push("INDIVIDUAL_ONBOARDING");
      }
    }
  }

  if (input.entityOnboardingRequestId) {
    const body = await maybeQuery("ENTITY_ONBOARDING", () =>
      session.getEntityOnboardingDetails(input.entityOnboardingRequestId!)
    );
    if (body) {
      const next = extractRegTankStatus(body);
      if (next) {
        regtankPipelineStatus = next;
        refreshedSources.push("ENTITY_ONBOARDING");
      }
    }
  }

  if (input.corporateOnboardingRequestId) {
    const body = await maybeQuery("CORPORATE_ONBOARDING", () =>
      session.getCorporateOnboardingDetails(input.corporateOnboardingRequestId!)
    );
    if (body) {
      const next = extractRegTankStatus(body);
      if (next) {
        regtankPipelineStatus = next;
        refreshedSources.push("CORPORATE_ONBOARDING");
      }
    }
  }

  // 2) Live KYC screening status (prefer ids passed by caller)
  let kycId = input.kycId;
  if (!kycId && individualDetails) {
    // Best-effort: onboardingDetails often returns `kycId` once already completed.
    kycId = findKycIdFromOnboardingDetails(individualDetails);
  }
  let screeningPatch: Record<string, unknown> | null = null;
  if (kycId) {
    const kycBody = await maybeQuery("KYC", () => session.queryKYCStatus(kycId!));
    if (kycBody) {
      const patch = extractRegTankScreeningPatch(kycBody, kycId);
      if (patch) {
        screeningPatch = patch;
        refreshedSources.push("KYC");
      }
    }
  }

  // 3) Live KYB screening status (optional)
  if (!screeningPatch && input.kybId) {
    const kybBody = await maybeQuery("KYB", () => session.queryKYBStatus(input.kybId!));
    if (kybBody) {
      const patch = extractRegTankScreeningPatch(kybBody, input.kybId);
      if (patch) {
        screeningPatch = patch;
        refreshedSources.push("KYB");
      }
    }
  }

  if (!regtankPipelineStatus && !screeningPatch) {
    return { refreshedSources };
  }

  // 4) Persist: merge into existing CTOS supplement onboarding_json
  const { id: existingId, onboardingJson } = await getOrCreateCtosPartySupplementBase(
    portal,
    organizationId,
    partyKey,
    prisma
  );

  const patch: Parameters<typeof mergeCtosPartySupplementDocument>[1] = {};
  if (regtankPipelineStatus) patch.regtankPipelineStatus = regtankPipelineStatus;
  if (screeningPatch) patch.screening = screeningPatch;

  const merged = mergeCtosPartySupplementDocument(onboardingJson, patch);

  try {
    if (existingId) {
      await prisma.ctosPartySupplement.update({
        where: { id: existingId },
        data: { onboarding_json: merged as Prisma.InputJsonValue },
      });
    } else {
      await prisma.ctosPartySupplement.create({
        data: {
          issuer_organization_id: portal === "issuer" ? organizationId : null,
          investor_organization_id: portal === "investor" ? organizationId : null,
          party_key: partyKey,
          onboarding_json: merged as Prisma.InputJsonValue,
        },
      });
    }
  } catch (err) {
    logger.warn(
      {
        portal,
        organizationId,
        partyKey,
        error: err instanceof Error ? err.message : String(err),
      },
      "Failed to persist immediate RegTank party sync (non-blocking)"
    );
  }

  return { refreshedSources };
}

