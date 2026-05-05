/**
 * SECTION: Issuer director/shareholder notifications (Option A)
 * WHY: Alert issuer on AML-driven mismatch transitions — no workflow state.
 * WHERE USED: After issuer org CTOS report insert; AML/supplement updates.
 */

import {
  computeNewIssuerDirectorShareholderIndividualsAfterCtosVisibleDiff,
  filterVisiblePeopleRows,
  isReadyOnboardingStatus,
  normalizeDirectorShareholderIdKey,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { buildAdminPeopleList } from "../admin/build-people-list";
import { OrganizationService } from "../organization/service";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { NotificationService } from "./service";
import { NotificationTypeIds } from "./registry";

type SupplementRow = { party_key: string; onboarding_json: unknown };

function buildPeopleListParams(params: {
  ctos: unknown;
  corporateEntities: unknown;
  directorKycStatus: unknown;
  directorAmlStatus: unknown;
  supplements: { partyKey: string; onboardingJson: unknown }[];
}) {
  const ctosPartySupplements: SupplementRow[] = params.supplements.map((s) => ({
    party_key: s.partyKey,
    onboarding_json: s.onboardingJson,
  }));
  return {
    ctos: params.ctos,
    corporateEntities: params.corporateEntities,
    issuerDirectorKycStatus: params.directorKycStatus,
    issuerDirectorAmlStatus: params.directorAmlStatus,
    ctosPartySupplements,
  };
}

type PeopleListInput = ReturnType<typeof buildPeopleListParams>;

function computeVisiblePeopleState(input: PeopleListInput): {
  people: ApplicationPersonRow[];
  visible: ApplicationPersonRow[];
} {
  const people = buildAdminPeopleList(input);
  const visible = filterVisiblePeopleRows(people).filter((p) => p.entityType === "INDIVIDUAL");
  return { people, visible };
}

/**
 * After a new issuer org CTOS company snapshot row exists: optional mismatch create + resolve if cleared.
 */
export async function runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert(params: {
  issuerOrganizationId: string;
  ownerUserId: string;
  beforeCompanyJson: unknown | null;
  afterCompanyJson: unknown | null;
  newCtosReportId: string;
  corporateEntities: unknown;
  directorKycStatus: unknown;
  directorAmlStatus: unknown;
  supplements: { partyKey: string; onboardingJson: unknown }[];
}): Promise<void> {
  const {
    issuerOrganizationId,
    ownerUserId,
    beforeCompanyJson,
    afterCompanyJson,
    newCtosReportId,
    corporateEntities,
    directorKycStatus,
    directorAmlStatus,
    supplements,
  } = params;

  if (!ownerUserId?.trim()) {
    logger.warn({ issuerOrganizationId }, "DS notifications: missing owner_user_id, skip");
    return;
  }

  const beforeInput = buildPeopleListParams({
    ctos: beforeCompanyJson,
    corporateEntities,
    directorKycStatus,
    directorAmlStatus,
    supplements,
  });
  const afterInput = buildPeopleListParams({
    ctos: afterCompanyJson,
    corporateEntities,
    directorKycStatus,
    directorAmlStatus,
    supplements,
  });

  const { visible: beforeVisible } = computeVisiblePeopleState(beforeInput);
  const { visible: afterVisible } = computeVisiblePeopleState(afterInput);

  const newPeopleWithoutOnboarding = computeNewIssuerDirectorShareholderIndividualsAfterCtosVisibleDiff({
    beforeVisibleIndividuals: beforeVisible,
    afterVisibleIndividuals: afterVisible,
    issuerDirectorKycStatus: directorKycStatus,
    issuerDirectorAmlStatus: directorAmlStatus,
    ctosPartySupplements: supplements.map((s) => ({ party_key: s.partyKey })),
  });
  const shouldTriggerNotification = afterVisible.length > 0 && newPeopleWithoutOnboarding.length > 0;

  logger.debug(
    {
      issuerOrganizationId,
      ownerUserId,
      newCtosReportId,
      beforeVisibleCount: beforeVisible.length,
      afterVisibleCount: afterVisible.length,
      newPeopleWithoutOnboardingCount: newPeopleWithoutOnboarding.length,
      shouldTriggerNotification,
    },
    "DS mismatch check"
  );

  await resolveIssuerDirectorShareholderNotificationsIfCleared({
    issuerOrganizationId,
    ownerUserId,
    visible: afterVisible,
  });

  if (shouldTriggerNotification) {
    const notificationService = new NotificationService();
    for (const person of newPeopleWithoutOnboarding) {
      const partyKey = normalizeDirectorShareholderIdKey(person.matchKey);
      if (!partyKey) continue;
      const idempotencyKey = `ds_action_required:${issuerOrganizationId}:${newCtosReportId}:${partyKey}`;
      const dupKey = await prisma.notification.findUnique({
        where: { idempotency_key: idempotencyKey },
      });
      if (dupKey) {
        logger.debug(
          { issuerOrganizationId, newCtosReportId, partyKey, idempotencyKey },
          "DS action-required skipped: duplicate idempotency key"
        );
        continue;
      }
      await notificationService.sendTyped(
        ownerUserId,
        NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        { issuerOrganizationId, partyKey, personName: person.name ?? undefined, link: "/profile" },
        idempotencyKey
      );
      logger.info(
        { issuerOrganizationId, newCtosReportId, ownerUserId, partyKey },
        "Created director_shareholder_action_required notification"
      );
    }
  } else {
    logger.debug(
      {
        issuerOrganizationId,
        afterVisibleCount: afterVisible.length,
        newPeopleWithoutOnboardingCount: newPeopleWithoutOnboarding.length,
      },
      "DS mismatch skipped: no new person needing onboarding notification"
    );
  }
}

/**
 * Recompute from DB and resolve mismatch notifications when AML and onboarding are fully clear for visible people.
 */
export async function runIssuerDirectorShareholderNotificationResolutionFromDb(
  issuerOrganizationId: string
): Promise<void> {
  const org = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
    select: {
      owner_user_id: true,
      corporate_entities: true,
      director_kyc_status: true,
      director_aml_status: true,
    },
  });
  if (!org?.owner_user_id) return;

  const orgService = new OrganizationService();
  const extras = await orgService.getIssuerPartyListExtras(issuerOrganizationId);
  const listInput = buildPeopleListParams({
    ctos: extras.latestOrganizationCtosCompanyJson ?? null,
    corporateEntities: org.corporate_entities ?? null,
    directorKycStatus: org.director_kyc_status ?? null,
    directorAmlStatus: org.director_aml_status ?? null,
    supplements: extras.ctosPartySupplements,
  });
  const { visible } = computeVisiblePeopleState(listInput);

  await resolveIssuerDirectorShareholderNotificationsIfCleared({
    issuerOrganizationId,
    ownerUserId: org.owner_user_id,
    visible,
  });
}

async function resolveIssuerDirectorShareholderNotificationsIfCleared(params: {
  issuerOrganizationId: string;
  ownerUserId: string;
  visible: ApplicationPersonRow[];
}): Promise<void> {
  const { issuerOrganizationId, ownerUserId, visible } = params;
  const noOneNeedsOnboarding = visible.every((p) => isReadyOnboardingStatus(p.onboarding?.status));
  const shouldResolve = visible.length > 0 && noOneNeedsOnboarding;
  if (!shouldResolve) {
    return;
  }

  await prisma.notification.updateMany({
    where: {
      user_id: ownerUserId,
      notification_type_id: NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH,
      resolved_at: null,
      metadata: {
        path: ["issuerOrganizationId"],
        equals: issuerOrganizationId,
      },
    },
    data: { resolved_at: new Date() },
  });
}

export async function notifyIssuerDirectorShareholderActionRequired(params: {
  issuerOrganizationId: string;
  ownerUserId: string;
  partyKeyRaw: string;
  personName?: string | null;
}): Promise<void> {
  const pk = normalizeDirectorShareholderIdKey(params.partyKeyRaw);
  if (!pk || !params.ownerUserId?.trim()) {
    logger.warn(
      { issuerOrganizationId: params.issuerOrganizationId },
      "DS action-required notification skipped: invalid key"
    );
    return;
  }

  const notificationService = new NotificationService();
  await notificationService.sendTyped(
    params.ownerUserId,
    NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
    {
      issuerOrganizationId: params.issuerOrganizationId,
      partyKey: pk,
      personName: params.personName ?? undefined,
      link: "/profile",
    }
  );
}
