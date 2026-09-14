/**
 * Party-scoped RegTank refresh for later-added People & Access rows.
 * Does not refresh the parent organisation COD, CTOS source-of-truth, or adopt/structure.
 */
import { OrganizationMemberRole, OrganizationType, Prisma } from "@prisma/client";
import {
  collectPartyRegTankRefreshIds,
  isLaterAddedCompanyPerson,
  isPartyRegTankProcessTerminal,
  mergeCtosPartySupplementDocument,
  partyAmlRefreshIds,
  partyHasRegTankRefreshIds,
  partyKeyMatchesLookup,
  partyKycRefreshIds,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { OrganizationService } from "../organization/service";
import { RegTankAPIClient } from "../regtank/api-client";
import { isRegTankRateLimited, REGTANK_RATE_LIMITED_CODE } from "../regtank/helpers/regtank-rate-limit";
import {
  REFRESH_IN_PROGRESS_CODE,
  runExclusiveOnboardingRefresh,
} from "../regtank/helpers/regtank-refresh-lock";
import {
  RegTankRefreshClient,
  RegTankRefreshSession,
} from "../regtank/helpers/regtank-refresh-session";

export const PARTY_STATUS_REFRESHED_MESSAGE = "Status refreshed.";
export const PARTY_STATUS_REFRESH_FAILED_MESSAGE =
  "Unable to refresh this status right now. Please try again.";
export const PARTY_STATUS_REFRESH_RECENTLY_MESSAGE =
  "Status was refreshed recently. Please wait a moment and try again.";

type Portal = "issuer" | "investor";

export type RefreshPartyRegTankStatusDeps = {
  organizationService?: Pick<OrganizationService, "getOrganization" | "getCorporateEntities">;
  regTankClient?: RegTankRefreshClient;
};

export type RefreshPartyRegTankStatusResult = {
  message: string;
  refreshedSources: string[];
};

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

function findPersonForParty(
  people: ApplicationPersonRow[],
  partyKey: string,
  identityNumber: string | null
): ApplicationPersonRow | undefined {
  return people.find(
    (row) =>
      partyKeyMatchesLookup(row.matchKey, partyKey) ||
      (identityNumber != null && partyKeyMatchesLookup(row.matchKey, identityNumber))
  );
}

function friendlyRateLimitError(): AppError {
  return new AppError(429, REGTANK_RATE_LIMITED_CODE, PARTY_STATUS_REFRESH_RECENTLY_MESSAGE);
}

function rethrowControlError(error: unknown): void {
  if (error instanceof AppError && error.code === REFRESH_IN_PROGRESS_CODE) {
    throw new AppError(429, REGTANK_RATE_LIMITED_CODE, PARTY_STATUS_REFRESH_RECENTLY_MESSAGE);
  }
  if (isRegTankRateLimited(error)) {
    throw friendlyRateLimitError();
  }
}

async function queryStatus(
  load: () => Promise<unknown>,
  source: string
): Promise<{ source: string; body: unknown } | { source: string; failed: true }> {
  try {
    const body = await load();
    return { source, body };
  } catch (error) {
    rethrowControlError(error);
    logger.warn(
      { source, error: error instanceof Error ? error.message : "provider_error" },
      "Party RegTank refresh query failed"
    );
    return { source, failed: true };
  }
}

export async function refreshPartyRegTankStatus(
  userId: string,
  portal: Portal,
  organizationId: string,
  partyId: string,
  deps: RefreshPartyRegTankStatusDeps = {}
): Promise<RefreshPartyRegTankStatusResult> {
  const organizationService = deps.organizationService ?? new OrganizationService();
  const organization = await organizationService.getOrganization(userId, organizationId, portal);
  if (organization.type !== OrganizationType.COMPANY) {
    throw new AppError(400, "NOT_SUPPORTED", "This organisation does not have People & Access.");
  }
  const member = organization.members.find((row) => row.user_id === userId);
  const canManage =
    organization.owner_user_id === userId || member?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;
  if (!canManage) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to refresh this status");
  }

  const party = await prisma.organizationPartyProfile.findFirst({
    where:
      portal === "issuer"
        ? { id: partyId, issuer_organization_id: organizationId }
        : { id: partyId, investor_organization_id: organizationId },
    select: {
      id: true,
      party_key: true,
      origin: true,
      membership_status: true,
      identity_number: true,
    },
  });
  if (!party) {
    throw new AppError(404, "NOT_FOUND", "Party profile not found");
  }
  if (party.membership_status !== "MASTER_ACTIVE") {
    throw new AppError(400, "NOT_ALLOWED", "This person is not active on the company profile.");
  }
  if (!isLaterAddedCompanyPerson({ origin: party.origin, partyKey: party.party_key })) {
    throw new AppError(
      400,
      "NOT_ALLOWED",
      "Status refresh is only available for people added after onboarding."
    );
  }

  const entities = await organizationService.getCorporateEntities(userId, organizationId, portal);
  const person = findPersonForParty(entities.people ?? [], party.party_key, party.identity_number);
  if (!person) {
    throw new AppError(400, "NO_REQUEST", "This person has no RegTank request to refresh.");
  }

  const ids = collectPartyRegTankRefreshIds(person);
  if (!partyHasRegTankRefreshIds(ids)) {
    throw new AppError(400, "NO_REQUEST", "This person has no RegTank request to refresh.");
  }

  const kycActive = partyKycRefreshIds(ids).length > 0 && !isPartyRegTankProcessTerminal(person.onboarding?.status);
  const amlActive = partyAmlRefreshIds(ids).length > 0 && !isPartyRegTankProcessTerminal(person.screening?.status);
  if (!kycActive && !amlActive) {
    throw new AppError(400, "NO_REQUEST", "This person has no RegTank request to refresh.");
  }

  const lockKey = `party-regtank:${organizationId}:${partyId}`;
  const locked = await runExclusiveOnboardingRefresh(lockKey, async () => {
    const client = deps.regTankClient ?? new RegTankAPIClient();
    const session = new RegTankRefreshSession(client);
    const results: Array<{ source: string; body: unknown } | { source: string; failed: true }> = [];

    if (kycActive && ids.individualOnboardingRequestId) {
      results.push(
        await queryStatus(
          () => session.queryOnboardingDetails(ids.individualOnboardingRequestId!),
          "INDIVIDUAL_ONBOARDING"
        )
      );
    }
    if (kycActive && ids.entityOnboardingRequestId) {
      results.push(
        await queryStatus(
          () => session.getEntityOnboardingDetails(ids.entityOnboardingRequestId!),
          "ENTITY_ONBOARDING"
        )
      );
    }
    if (kycActive && ids.corporateOnboardingRequestId) {
      results.push(
        await queryStatus(
          () => session.getCorporateOnboardingDetails(ids.corporateOnboardingRequestId!),
          "CORPORATE_ONBOARDING"
        )
      );
    }
    if (amlActive && ids.kycId) {
      results.push(await queryStatus(() => session.queryKYCStatus(ids.kycId!), "KYC"));
    }
    if (amlActive && ids.kybId) {
      results.push(await queryStatus(() => session.queryKYBStatus(ids.kybId!), "KYB"));
    }

    const failed = results.filter((row): row is { source: string; failed: true } => "failed" in row);
    const succeeded = results.filter(
      (row): row is { source: string; body: unknown } => "body" in row
    );
    if (succeeded.length === 0) {
      throw new AppError(502, "PROVIDER_REFRESH_FAILED", PARTY_STATUS_REFRESH_FAILED_MESSAGE);
    }

    let onboardingStatus: string | undefined;
    for (const row of succeeded) {
      if (
        row.source === "INDIVIDUAL_ONBOARDING" ||
        row.source === "ENTITY_ONBOARDING" ||
        row.source === "CORPORATE_ONBOARDING"
      ) {
        const next = extractRegTankStatus(row.body);
        if (next) onboardingStatus = next;
      }
    }

    let screeningPatch: Record<string, unknown> | null = null;
    for (const row of succeeded) {
      if (row.source === "KYC" || row.source === "KYB") {
        const requestId = row.source === "KYC" ? ids.kycId : ids.kybId;
        const next = extractRegTankScreeningPatch(row.body, requestId ?? "");
        if (next) screeningPatch = next;
      }
    }

    if (onboardingStatus || screeningPatch) {
      const supplementWhere =
        portal === "issuer"
          ? { issuer_organization_id: organizationId, party_key: party.party_key }
          : { investor_organization_id: organizationId, party_key: party.party_key };
      const existing = await prisma.ctosPartySupplement.findFirst({ where: supplementWhere });
      const patch: Parameters<typeof mergeCtosPartySupplementDocument>[1] = {};
      if (onboardingStatus) patch.regtankPipelineStatus = onboardingStatus;
      if (screeningPatch) patch.screening = screeningPatch;
      if (!existing) {
        const requestId =
          ids.individualOnboardingRequestId ||
          ids.entityOnboardingRequestId ||
          ids.corporateOnboardingRequestId ||
          ids.kycId ||
          ids.kybId;
        if (requestId) patch.onboarding = { requestId };
      }
      const merged = mergeCtosPartySupplementDocument(existing?.onboarding_json, patch);
      if (existing) {
        await prisma.ctosPartySupplement.update({
          where: { id: existing.id },
          data: { onboarding_json: merged as Prisma.InputJsonValue },
        });
      } else {
        await prisma.ctosPartySupplement.create({
          data: {
            issuer_organization_id: portal === "issuer" ? organizationId : null,
            investor_organization_id: portal === "investor" ? organizationId : null,
            party_key: party.party_key,
            onboarding_json: merged as Prisma.InputJsonValue,
          },
        });
      }
    }

    logger.info(
      {
        organizationId,
        partyId,
        portal,
        refreshedSources: succeeded.map((row) => row.source),
        partialFailures: failed.map((row) => row.source),
      },
      "Party RegTank status refreshed"
    );

    return {
      message: PARTY_STATUS_REFRESHED_MESSAGE,
      refreshedSources: succeeded.map((row) => row.source),
    };
  });

  if (locked === "IN_PROGRESS") {
    throw new AppError(429, REGTANK_RATE_LIMITED_CODE, PARTY_STATUS_REFRESH_RECENTLY_MESSAGE);
  }
  return locked;
}
