import { OrganizationType } from "@prisma/client";
import { logger } from "../../../lib/logger";

/**
 * Shared guards for RegTank webhook handlers.
 *
 * These helpers protect matched `regtank_onboarding` rows from being mutated by:
 * - events belonging to a cancelled/superseded onboarding attempt, and
 * - events whose webhook family does not match the resolved record's type.
 *
 * They never look up an alternative record and never change a row's status;
 * callers are expected to persist the raw payload first, call the relevant
 * guard, and return immediately (without further mutation) when it fails.
 */

export const CANCELLED_ONBOARDING_STATUS = "CANCELLED";

export interface OnboardingGuardRow {
  id: string;
  request_id: string;
  status: string;
  onboarding_type: string;
  organization_type: OrganizationType;
  investor_organization_id: string | null;
  issuer_organization_id: string | null;
}

function resolveOrganizationId(
  onboarding: Pick<OnboardingGuardRow, "investor_organization_id" | "issuer_organization_id">
): string | null {
  return onboarding.investor_organization_id || onboarding.issuer_organization_id || null;
}

/** True when the matched onboarding row is a cancelled/superseded attempt. */
export function isCancelledOnboardingRow(onboarding: Pick<OnboardingGuardRow, "status">): boolean {
  return onboarding.status === CANCELLED_ONBOARDING_STATUS;
}

/**
 * Log that a structurally valid webhook was resolved to a cancelled onboarding attempt.
 * Caller must have already preserved the raw payload on that row and must return
 * immediately after calling this (no status/organization mutation, no milestone logic).
 */
export function logCancelledOnboardingSkip(params: {
  webhookFamily: string;
  webhookRequestId: string;
  onboarding: Pick<OnboardingGuardRow, "id" | "request_id" | "investor_organization_id" | "issuer_organization_id">;
}): void {
  logger.warn(
    {
      event: "REGTANK_WEBHOOK_CANCELLED_ONBOARDING_SKIPPED",
      webhookFamily: params.webhookFamily,
      requestId: params.webhookRequestId,
      onboardingRowId: params.onboarding.id,
      onboardingRequestId: params.onboarding.request_id,
      organizationId: resolveOrganizationId(params.onboarding),
      reason: "onboarding row is CANCELLED (superseded attempt)",
    },
    "[RegTank Webhook] Event belongs to a cancelled/superseded onboarding attempt; payload preserved, no mutation applied"
  );
}

/** True when a `/liveness` (individual) webhook resolved to an INDIVIDUAL onboarding row. */
export function isIndividualWebhookFamilyMatch(
  onboarding: Pick<OnboardingGuardRow, "onboarding_type">
): boolean {
  return onboarding.onboarding_type === "INDIVIDUAL";
}

/** True when a `/codliveness` webhook resolved to a CORPORATE + COMPANY onboarding row. */
export function isCodWebhookFamilyMatch(
  onboarding: Pick<OnboardingGuardRow, "onboarding_type" | "organization_type">
): boolean {
  return onboarding.onboarding_type === "CORPORATE" && onboarding.organization_type === OrganizationType.COMPANY;
}

/** True when an `/eodliveness` webhook's resolved parent record is CORPORATE. */
export function isEodParentFamilyMatch(onboarding: Pick<OnboardingGuardRow, "onboarding_type">): boolean {
  return onboarding.onboarding_type === "CORPORATE";
}

/**
 * KYC/KYB resolve to either an INDIVIDUAL row (personal or company-authorized-individual,
 * both are documented, legitimate combinations) or a CORPORATE row (main company or
 * EOD-linked director/shareholder). A CORPORATE row must always be organization_type
 * COMPANY; anything else indicates a corrupted/mismatched association and must not be mutated.
 */
export function isAmlWebhookOnboardingTypeConsistent(
  onboarding: Pick<OnboardingGuardRow, "onboarding_type" | "organization_type">
): boolean {
  if (onboarding.onboarding_type === "CORPORATE") {
    return onboarding.organization_type === OrganizationType.COMPANY;
  }
  return true;
}

/**
 * Log a confirmed webhook-family/type mismatch. Caller must not update the matched row,
 * must not append the webhook to it, and must not search for an alternative record.
 */
export function logWebhookFamilyTypeMismatch(params: {
  webhookFamily: string;
  webhookRequestId: string;
  onboarding: Pick<
    OnboardingGuardRow,
    "id" | "request_id" | "onboarding_type" | "organization_type" | "investor_organization_id" | "issuer_organization_id"
  >;
  expected: string;
}): void {
  logger.warn(
    {
      event: "REGTANK_WEBHOOK_TYPE_MISMATCH",
      webhookFamily: params.webhookFamily,
      requestId: params.webhookRequestId,
      onboardingRowId: params.onboarding.id,
      onboardingRequestId: params.onboarding.request_id,
      organizationId: resolveOrganizationId(params.onboarding),
      resolvedOnboardingType: params.onboarding.onboarding_type,
      resolvedOrganizationType: params.onboarding.organization_type,
      expected: params.expected,
      reason: "resolved onboarding record type does not match expected webhook family",
    },
    "[RegTank Webhook] Webhook family/type mismatch on resolved onboarding record; skipping mutation"
  );
}
