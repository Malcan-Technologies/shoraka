/**
 * SECTION: Director/shareholder action-required notifications (issuer + investor company)
 * WHY: Alert org owner when CTOS shows new directors/shareholders needing onboarding.
 * WHERE USED: After admin org CTOS report insert; manual issuer admin notify API.
 */

import {
  computeNewIssuerDirectorShareholderIndividualsAfterCtosVisibleDiff,
  filterVisiblePeopleRows,
  normalizeDirectorShareholderIdKey,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { buildAdminPeopleList } from "../admin/build-people-list";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { NotificationService } from "./service";
import { sendTypedSafe } from "./send-typed-safe";
import { systemNotificationLogKey } from "./delivery-log";
import { NotificationTypeIds, type NotificationTypeId } from "./registry";

type SupplementRow = { party_key: string; onboarding_json: unknown };

type OrgCtosPeopleContext = {
  ownerUserId: string;
  beforeCompanyJson: unknown | null;
  afterCompanyJson: unknown | null;
  newCtosReportId: string;
  corporateEntities: unknown;
  directorKycStatus: unknown;
  directorAmlStatus: unknown;
  supplements: { partyKey: string; onboardingJson: unknown }[];
};

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

/** Gate for admin org-level CTOS insert notification hooks. */
export function shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert(params: {
  portal: "issuer" | "investor";
  organizationType: "PERSONAL" | "COMPANY";
  skipDirectorShareholderNotifications?: boolean;
  ownerUserId?: string | null;
}): boolean {
  if (params.skipDirectorShareholderNotifications) return false;
  if (!params.ownerUserId?.trim()) return false;
  if (params.portal === "issuer") return true;
  return params.portal === "investor" && params.organizationType === "COMPANY";
}

async function sendDirectorShareholderActionRequiredAfterOrgCtosReportInsert(params: {
  context: OrgCtosPeopleContext;
  organizationId: string;
  portal: "issuer" | "investor";
  notificationTypeId: NotificationTypeId;
  idempotencyKeyForParty: (partyKey: string) => string;
  buildSendPayload: (partyKey: string, personName?: string) => Record<string, unknown>;
  createdLogMessage: string;
}): Promise<void> {
  const {
    context,
    organizationId,
    portal,
    notificationTypeId,
    idempotencyKeyForParty,
    buildSendPayload,
    createdLogMessage,
  } = params;
  const {
    ownerUserId,
    beforeCompanyJson,
    afterCompanyJson,
    newCtosReportId,
    corporateEntities,
    directorKycStatus,
    directorAmlStatus,
    supplements,
  } = context;

  if (!ownerUserId?.trim()) {
    logger.warn({ organizationId, portal }, "DS notifications: missing owner_user_id, skip");
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

  const newPeopleWithoutOnboarding =
    computeNewIssuerDirectorShareholderIndividualsAfterCtosVisibleDiff({
      beforeVisibleIndividuals: beforeVisible,
      afterVisibleIndividuals: afterVisible,
      issuerDirectorKycStatus: directorKycStatus,
      issuerDirectorAmlStatus: directorAmlStatus,
      ctosPartySupplements: supplements.map((s) => ({ party_key: s.partyKey })),
    });
  const shouldTriggerNotification =
    afterVisible.length > 0 && newPeopleWithoutOnboarding.length > 0;

  logger.debug(
    {
      organizationId,
      portal,
      ownerUserId,
      newCtosReportId,
      beforeVisibleCount: beforeVisible.length,
      afterVisibleCount: afterVisible.length,
      newPeopleWithoutOnboardingCount: newPeopleWithoutOnboarding.length,
      shouldTriggerNotification,
    },
    "DS action-required check after CTOS org report"
  );

  if (!shouldTriggerNotification) {
    logger.debug(
      {
        organizationId,
        portal,
        afterVisibleCount: afterVisible.length,
        newPeopleWithoutOnboardingCount: newPeopleWithoutOnboarding.length,
      },
      "DS action-required skipped: no new person needing onboarding notification"
    );
    return;
  }

  const notificationService = new NotificationService();
  const results: Array<Awaited<ReturnType<NotificationService["sendTyped"]>>> = [];
  let firstPayload: Record<string, unknown> | null = null;
  for (const person of newPeopleWithoutOnboarding) {
    const partyKey = normalizeDirectorShareholderIdKey(person.matchKey);
    if (!partyKey) continue;
    const idempotencyKey = idempotencyKeyForParty(partyKey);
    const dupKey = await prisma.notification.findUnique({
      where: { idempotency_key: idempotencyKey },
    });
    if (dupKey) {
      logger.debug(
        { organizationId, portal, newCtosReportId, partyKey, idempotencyKey },
        "DS action-required skipped: duplicate idempotency key"
      );
      continue;
    }
    const payload = buildSendPayload(partyKey, person.name ?? undefined);
    if (!firstPayload) firstPayload = payload;
    const notification = await sendTypedSafe(
      notificationService,
      ownerUserId,
      notificationTypeId,
      payload as never,
      idempotencyKey
    );
    results.push(notification);
    logger.info(
      { organizationId, portal, newCtosReportId, ownerUserId, partyKey },
      createdLogMessage
    );
  }
  if (firstPayload) {
    await notificationService.logTypedSystemBatch(
      notificationTypeId,
      firstPayload as never,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          notificationTypeId,
          `ds_action_required:${portal}:${organizationId}:${newCtosReportId}`
        ),
        metadata: { organizationId, portal, newCtosReportId, attempted: results.length },
      }
    );
  }
}

/**
 * After a new issuer org CTOS company snapshot row exists: send action-required notifications for new parties.
 */
export async function runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert(
  params: OrgCtosPeopleContext & { issuerOrganizationId: string }
): Promise<void> {
  const { issuerOrganizationId, ...context } = params;
  await sendDirectorShareholderActionRequiredAfterOrgCtosReportInsert({
    context,
    organizationId: issuerOrganizationId,
    portal: "issuer",
    notificationTypeId: NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
    idempotencyKeyForParty: (partyKey) =>
      `ds_action_required:${issuerOrganizationId}:${context.newCtosReportId}:${partyKey}`,
    buildSendPayload: (partyKey, personName) => ({
      issuerOrganizationId,
      partyKey,
      personName,
      link: "/profile",
    }),
    createdLogMessage: "Created director_shareholder_action_required notification",
  });
}

/**
 * After a new investor company org CTOS company snapshot row exists: send action-required notifications.
 */
export async function runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert(
  params: OrgCtosPeopleContext & { investorOrganizationId: string }
): Promise<void> {
  const { investorOrganizationId, ...context } = params;
  await sendDirectorShareholderActionRequiredAfterOrgCtosReportInsert({
    context,
    organizationId: investorOrganizationId,
    portal: "investor",
    notificationTypeId: NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
    idempotencyKeyForParty: (partyKey) =>
      `ds_action_required:investor:${investorOrganizationId}:${context.newCtosReportId}:${partyKey}`,
    buildSendPayload: (partyKey, personName) => ({
      investorOrganizationId,
      partyKey,
      personName,
      link: "/profile",
    }),
    createdLogMessage: "Created investor_director_shareholder_action_required notification",
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
  const payload = {
    issuerOrganizationId: params.issuerOrganizationId,
    partyKey: pk,
    personName: params.personName ?? undefined,
    link: "/profile",
  };
  const notification = await sendTypedSafe(
    notificationService,
    params.ownerUserId,
    NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
    payload,
    `ds_action_required:${params.issuerOrganizationId}:${pk}`
  );
  await notificationService.logTypedSystemBatch(
    NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
    payload,
    [notification],
    {
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED,
        `ds_action_required:${params.issuerOrganizationId}:${pk}`
      ),
    }
  );
}
