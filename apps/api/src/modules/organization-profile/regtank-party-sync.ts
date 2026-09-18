import type { Prisma } from "@prisma/client";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import {
  mergeCtosPartySupplementDocument,
  pickPreferredDirectorShareholderOnboarding,
} from "@cashsouk/types";
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

function screeningProviderFromRequestId(requestId: string): "DOWJONES" | "ACURIS" {
  const upper = requestId.trim().toUpperCase();
  return upper.startsWith("DJKYC") || upper.startsWith("DJKYB") ? "DOWJONES" : "ACURIS";
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
    provider: screeningProviderFromRequestId(id),
    updatedAt: new Date().toISOString(),
  };
  if (isRecord(row)) {
    // Actual `/v3/kyc/query` response shape (your KYC00196 example):
    // {
    //   requestId, messageStatus, status,
    //   individualRiskScore: { level, score, ... }
    // }
    const irs = row.individualRiskScore;
    if (isRecord(irs)) {
      if (irs.level != null) patch.riskLevel = irs.level;
      if (irs.score != null) patch.riskScore = irs.score;
    }

    const crs = row.corporateRiskScore;
    if (isRecord(crs)) {
      if (patch.riskLevel === undefined && crs.level != null) patch.riskLevel = crs.level;
      if (patch.riskScore === undefined && crs.score != null) patch.riskScore = crs.score;
    }

    // Backward-compatible: support older/alternative shapes if present.
    if (patch.riskLevel === undefined && row.riskLevel != null) patch.riskLevel = row.riskLevel;
    if (patch.riskScore === undefined && row.riskScore != null) patch.riskScore = row.riskScore;

    // Webhook-like field name for AML messaging state.
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
  /** Live discovery confirmed the current child has no KYC/KYB identifier. */
  clearScreening?: boolean;
  regTankClient?: RegTankRefreshClient;
  session?: RegTankRefreshSession;
  requirePersistence?: boolean;
  requireCompleteRefresh?: boolean;
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
  const session = input.session ?? new RegTankRefreshSession(regTankClient);

  const refreshedSources: string[] = [];
  let regtankPipelineStatus: string | null = null;
  let pipelineRequestId: string | null = null;

  // 1) Live onboarding pipeline status
  let individualDetails: unknown | null = null;

  const maybeQuery = async <T,>(label: string, load: () => Promise<T>): Promise<T | null> => {
    try {
      return await load();
    } catch (error) {
      rethrowControlError(error);
      if (input.requireCompleteRefresh) {
        throw new AppError(
          502,
          "PROVIDER_REFRESH_FAILED",
          "RegTank did not return a complete status for this person. The stored status was not changed."
        );
      }
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
        const preferred = pickPreferredDirectorShareholderOnboarding(
          pipelineRequestId && regtankPipelineStatus
            ? { status: regtankPipelineStatus, id: pipelineRequestId }
            : null,
          { status: next, id: input.individualOnboardingRequestId }
        );
        regtankPipelineStatus = preferred?.status || next;
        pipelineRequestId = preferred?.id || input.individualOnboardingRequestId;
        refreshedSources.push("INDIVIDUAL_ONBOARDING");
      } else if (input.requireCompleteRefresh) {
        throw new AppError(
          502,
          "PROVIDER_REFRESH_FAILED",
          "RegTank did not return an onboarding status for this person."
        );
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
        const preferred = pickPreferredDirectorShareholderOnboarding(
          pipelineRequestId && regtankPipelineStatus
            ? { status: regtankPipelineStatus, id: pipelineRequestId }
            : null,
          { status: next, id: input.entityOnboardingRequestId }
        );
        regtankPipelineStatus = preferred?.status || next;
        pipelineRequestId = preferred?.id || input.entityOnboardingRequestId;
        refreshedSources.push("ENTITY_ONBOARDING");
      } else if (input.requireCompleteRefresh) {
        throw new AppError(
          502,
          "PROVIDER_REFRESH_FAILED",
          "RegTank did not return an onboarding status for this person."
        );
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
        const preferred = pickPreferredDirectorShareholderOnboarding(
          pipelineRequestId && regtankPipelineStatus
            ? { status: regtankPipelineStatus, id: pipelineRequestId }
            : null,
          { status: next, id: input.corporateOnboardingRequestId }
        );
        regtankPipelineStatus = preferred?.status || next;
        pipelineRequestId = preferred?.id || input.corporateOnboardingRequestId;
        refreshedSources.push("CORPORATE_ONBOARDING");
      } else if (input.requireCompleteRefresh) {
        throw new AppError(
          502,
          "PROVIDER_REFRESH_FAILED",
          "RegTank did not return an onboarding status for this entity."
        );
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
      } else if (input.requireCompleteRefresh) {
        throw new AppError(
          502,
          "PROVIDER_REFRESH_FAILED",
          "RegTank did not return an AML screening status for this person."
        );
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
      } else if (input.requireCompleteRefresh) {
        throw new AppError(
          502,
          "PROVIDER_REFRESH_FAILED",
          "RegTank did not return an AML screening status for this entity."
        );
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
  if (regtankPipelineStatus) {
    patch.regtankPipelineStatus = regtankPipelineStatus;
    if (pipelineRequestId) patch.onboarding = { requestId: pipelineRequestId };
  }
  if (screeningPatch) patch.screening = screeningPatch;
  else if (input.clearScreening) patch.screeningReset = true;

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
      "Failed to persist immediate RegTank party sync"
    );
    if (input.requirePersistence) {
      throw new AppError(
        500,
        "PERSISTENCE_FAILED",
        "RegTank returned a status, but it could not be saved. Please try again."
      );
    }
  }

  return { refreshedSources };
}

