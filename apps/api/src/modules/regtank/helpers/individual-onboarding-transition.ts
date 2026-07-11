import { OnboardingStatus } from "@prisma/client";

/**
 * Pure decision helpers for the personal/individual RegTank onboarding webhook
 * (`individual-onboarding-handler.ts`, `/liveness`).
 *
 * These are intentionally separate from `cod-amendment-transition.ts`: corporate COD
 * transitions involve SSM review/amendment stages and org-type/portal-type branching
 * that do not exist for personal onboarding. Individual onboarding only has a single
 * pre-review landing stage (`PENDING_APPROVAL`), so a dedicated, smaller helper avoids
 * forcing mismatched corporate semantics onto the personal flow.
 */

/**
 * Stages that have not yet reached "awaiting admin/RegTank review".
 * `LIVENESS_PASSED` / `WAIT_FOR_APPROVAL` may only land the organization on
 * `PENDING_APPROVAL` while it is still in one of these pre-review stages (this
 * includes an idempotent re-delivery once already at `PENDING_APPROVAL`).
 */
const PRE_REVIEW_ONBOARDING_STATUSES: ReadonlySet<OnboardingStatus> = new Set([
  OnboardingStatus.PENDING,
  OnboardingStatus.IN_PROGRESS,
  OnboardingStatus.PENDING_APPROVAL,
]);

export type IndividualWaitForApprovalUpdate = {
  nextStatus: "PENDING_APPROVAL";
};

/**
 * Decide whether a `LIVENESS_PASSED` or `WAIT_FOR_APPROVAL` individual webhook may
 * (re)apply the "awaiting review" landing status.
 *
 * Duplicate or out-of-order individual webhooks must never regress an organization
 * that has already progressed past review (`PENDING_AML`, `PENDING_FINAL_APPROVAL`,
 * `COMPLETED`) or is terminal (`REJECTED`). Returns `null` when the update must be
 * skipped.
 */
export function getIndividualWaitForApprovalUpdate(params: {
  currentOnboardingStatus: OnboardingStatus;
}): IndividualWaitForApprovalUpdate | null {
  if (!PRE_REVIEW_ONBOARDING_STATUSES.has(params.currentOnboardingStatus)) {
    return null;
  }
  return { nextStatus: "PENDING_APPROVAL" };
}

export type IndividualApprovedOutcome =
  | "heal-to-pending-approval"
  | "set-approved-and-advance"
  | "advance-only";

/** Stages before the organization has ever reached `PENDING_APPROVAL`. */
const PRE_PENDING_APPROVAL_STATUSES: ReadonlySet<OnboardingStatus> = new Set([
  OnboardingStatus.PENDING,
  OnboardingStatus.IN_PROGRESS,
]);

/**
 * Decide how a RegTank `APPROVED` individual onboarding webhook should affect the
 * organization, given its current onboarding_status/onboarding_approved.
 *
 * - `heal-to-pending-approval`: the org has not reached `PENDING_APPROVAL` yet (e.g. the
 *   `APPROVED` webhook arrived before `WAIT_FOR_APPROVAL`/`LIVENESS_PASSED` was
 *   processed). Safe to land it on `PENDING_APPROVAL` with `onboarding_approved` set.
 * - `set-approved-and-advance`: org is on `PENDING_APPROVAL` and not yet approved —
 *   apply the milestone once, then run the shared sequencing helper.
 * - `advance-only`: org already has `onboarding_approved` set, or is in a later/terminal
 *   stage the milestone should not touch (duplicate `APPROVED`, or a late delivery after
 *   the org already advanced/completed/was rejected). Only re-run the shared, idempotent
 *   sequencing helper — never mutate status/flags directly here.
 */
export function decideIndividualApprovedOutcome(params: {
  currentOnboardingStatus: OnboardingStatus;
  onboardingApproved: boolean;
}): IndividualApprovedOutcome {
  const { currentOnboardingStatus, onboardingApproved } = params;

  if (PRE_PENDING_APPROVAL_STATUSES.has(currentOnboardingStatus)) {
    return "heal-to-pending-approval";
  }

  if (currentOnboardingStatus === OnboardingStatus.PENDING_APPROVAL && !onboardingApproved) {
    return "set-approved-and-advance";
  }

  return "advance-only";
}
