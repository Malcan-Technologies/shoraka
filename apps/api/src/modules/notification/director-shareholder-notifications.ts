/**
 * SECTION: Issuer director/shareholder notifications (Option A)
 * WHY: Alert issuer on AML-driven mismatch transitions and admin reject — no workflow state.
 * WHERE USED: After issuer org CTOS report insert; AML/supplement updates; admin reject route.
 */

import {
  filterVisiblePeopleRows,
  normalizeDirectorShareholderIdKey,
  peopleHasPendingDirectorShareholderAml,
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

function computeVisiblePendingState(input: PeopleListInput): {
  people: ApplicationPersonRow[];
  visible: ApplicationPersonRow[];
  nowPending: boolean;
} {
  const people = buildAdminPeopleList(input);
  const visible = filterVisiblePeopleRows(people);
  const nowPending = peopleHasPendingDirectorShareholderAml(visible);
  return { people, visible, nowPending };
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

  const { nowPending: wasPending } = computeVisiblePendingState(beforeInput);
  const { people: afterPeople, visible: afterVisible, nowPending } = computeVisiblePendingState(afterInput);

  await resolveIssuerDirectorShareholderNotificationsIfCleared({
    issuerOrganizationId,
    ownerUserId,
    people: afterPeople,
    visible: afterVisible,
    nowPending,
  });

  if (!wasPending && nowPending && afterVisible.length > 0) {
    const active = await prisma.notification.findFirst({
      where: {
        user_id: ownerUserId,
        notification_type_id: NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH,
        resolved_at: null,
        metadata: {
          path: ["issuerOrganizationId"],
          equals: issuerOrganizationId,
        },
      },
    });
    if (active) {
      return;
    }

    const idempotencyKey = `ds_mismatch:${issuerOrganizationId}:${newCtosReportId}`;
    const dupKey = await prisma.notification.findUnique({
      where: { idempotency_key: idempotencyKey },
    });
    if (dupKey) {
      return;
    }

    const notificationService = new NotificationService();
    await notificationService.sendTyped(
      ownerUserId,
      NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH,
      { issuerOrganizationId },
      idempotencyKey
    );
    logger.info(
      { issuerOrganizationId, newCtosReportId, ownerUserId },
      "Created director_shareholder_mismatch notification"
    );
  }
}

/**
 * Recompute from DB and resolve mismatch + per-party rejected rows when AML is fully clear for visible people.
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
  const { people, visible, nowPending } = computeVisiblePendingState(listInput);

  await resolveIssuerDirectorShareholderNotificationsIfCleared({
    issuerOrganizationId,
    ownerUserId: org.owner_user_id,
    people,
    visible,
    nowPending,
  });
}

async function resolveIssuerDirectorShareholderNotificationsIfCleared(params: {
  issuerOrganizationId: string;
  ownerUserId: string;
  people: ApplicationPersonRow[];
  visible: ApplicationPersonRow[];
  nowPending: boolean;
}): Promise<void> {
  const { issuerOrganizationId, ownerUserId, people, visible, nowPending } = params;

  const shouldResolve =
    (visible.length === 0 && people.length === 0) || (visible.length > 0 && !nowPending);
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

  await prisma.notification.updateMany({
    where: {
      user_id: ownerUserId,
      notification_type_id: NotificationTypeIds.DIRECTOR_SHAREHOLDER_REJECTED,
      resolved_at: null,
      metadata: {
        path: ["issuerOrganizationId"],
        equals: issuerOrganizationId,
      },
    },
    data: { resolved_at: new Date() },
  });
}

export async function notifyIssuerDirectorShareholderRejected(params: {
  issuerOrganizationId: string;
  ownerUserId: string;
  partyKeyRaw: string;
  personName?: string | null;
}): Promise<void> {
  const pk = normalizeDirectorShareholderIdKey(params.partyKeyRaw);
  if (!pk || !params.ownerUserId?.trim()) {
    logger.warn({ issuerOrganizationId: params.issuerOrganizationId }, "DS rejected notification skipped: invalid key");
    return;
  }

  const notificationService = new NotificationService();
  await notificationService.sendTyped(
    params.ownerUserId,
    NotificationTypeIds.DIRECTOR_SHAREHOLDER_REJECTED,
    {
      issuerOrganizationId: params.issuerOrganizationId,
      partyKey: pk,
      personName: params.personName ?? undefined,
    }
  );
}
