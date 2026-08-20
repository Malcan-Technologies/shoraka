import { AdminRepository } from "./repository";
import {
  User,
  UserRole,
  Prisma,
  OrganizationType,
  OnboardingStatus,
  ApplicationStatus,
  ReviewSection,
  ReviewStepStatus,
  ApplicationGuarantor,
} from "@prisma/client";
import { Request } from "express";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { accessAuditLogReader } from "../auth/audit/reader";
import { securityAuditLogReader } from "../security/audit/reader";
import {
  onboardingAuditLogReader,
  type OnboardingAuditLogDto,
} from "../onboarding/audit/reader";
import { writeOnboardingAuditLog } from "../onboarding/audit/writer";
import {
  ONBOARDING_AUDIT_TARGET_TYPE,
  ONBOARDING_RESTART_TRIGGER,
} from "../onboarding/audit/events";
import { directorKycFinalOutcomes } from "../onboarding/audit/diff";
import { writeDirectorKycOutcomeAuditLogs } from "../onboarding/audit/director-kyc-outcomes";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_PORTAL,
  AUDIT_SOURCE,
  auditContextFromAdminRequest,
  auditContextFromRequest,
} from "../../lib/audit/context";
import { changedFieldsOf, permissionDiff, roleDiff } from "../../lib/audit/snapshot";
import { writeSecurityAuditLog } from "../security/audit/writer";
import { SECURITY_AUDIT_TARGET_TYPE } from "../security/audit/events";
import { sendEmail } from "../../lib/email/ses-client";
import { adminInvitationTemplate } from "../../lib/email/templates";
import { randomBytes } from "crypto";
import { logger } from "../../lib/logger";
import { advanceOnboardingStatusFromFlags } from "../onboarding/utils/advance-onboarding-status";
import {
  claimAmlApproved,
  claimFinalApprovalCompleted,
  claimOnboardingApproved,
  claimSsmApproved,
  lockOrganizationRow,
  readOrganizationOnboardingState,
} from "../onboarding/utils/onboarding-transition-claims";
import type {
  GetUsersQuery,
  GetAccessLogsQuery,
  UpdateUserRolesInput,
  UpdateUserOnboardingInput,
  UpdateUserProfileInput,
  GetAdminUsersQuery,
  CreateAdminRoleInput,
  UpdateAdminRoleInput,
  UpdateAdminRolePermissionsInput,
  InviteAdminInput,
  AcceptInvitationInput,
  GetSecurityLogsQuery,
  GetOnboardingLogsQuery,
  ResetOnboardingInput,
  GetOnboardingApplicationsQuery,
  GetAdminApplicationsQuery,
  GetAdminContractsQuery,
  GetOrganizationLinkedRecordsQuery,
  UpdateAdminOrganizationProfileBody,
} from "./schemas";
import { RegTankRepository, OnboardingApplicationRecord } from "../regtank/repository";
import { RegTankAPIClient } from "../regtank/api-client";
import { NotificationService } from "../notification/service";
import {
  NotificationPayloads,
  NotificationTypeId,
  NotificationTypeIds,
} from "../notification/registry";
import { getIssuerRecipientUserIdsForApplication } from "../notification/application-recipients";
import { listOrganizationLinkedRecords } from "./organization-linked-records";
import { sumApprovedFacilityAmount } from "./organization-header-metrics";
import { updateAdminOrganizationProfile } from "./organization-admin-profile";
import {
  assertAcceptanceDocumentChangeRequestAllowed,
  isAcceptanceDocumentItemId,
  isAcceptanceDocumentsAmendmentQueueScope,
  shouldNotifyAcceptanceDocumentChanges,
} from "./acceptance-document-change";
import { getRegTankConfig } from "../../config/regtank";
import {
  AdminRole,
  type AdminRoleBadgeColor,
  type AdminRoleConfigRecord,
  type AdminPermission,
  type AdminRoleKey,
  type OnboardingApprovalStatus,
  type OnboardingApplicationResponse,
  type OnboardingStatusEnum,
  type UserDetailResponse,
} from "@cashsouk/types";
import {
  ADMIN_PERMISSIONS,
  SYSTEM_ADMIN_ROLE_KEYS,
  getSectionForPendingAmendment,
  getSectionForScopeKey,
  parseItemScopeKey,
  REVIEW_SECTION_ORDER,
  getReviewSectionOrder,
  getReviewSectionPrerequisites,
  getStepKeyFromStepId,
  workflowHasAcceptanceDocuments,
  collectAcceptanceDocumentReviewKeys,
  getOfferAcceptanceFromOfferDetails,
  isOfferAcceptanceResendBlocked,
  isPhaseDeadlineExpired,
  workflowUsesOfferAcceptanceFlow,
  workflowShowsAcceptanceReviewSection,
  isAcceptanceHubCompleteFromOffer,
  shouldShowAcceptanceDocumentsReviewSection,
  isRegtankIso3166Code,
  normalizeDirectorShareholderIdKey,
  canManageDirectorShareholder,
  computeHasPendingDirectorShareholder,
  filterVisiblePeopleRows,
  WithdrawReason,
  type SoukscoreRiskRating,
  type OfferAcceptanceStatus,
  buildOriginationPhaseInput,
  canRejectApplication,
  canResetReviewToPending,
  resolveOriginationPhase,
} from "@cashsouk/types";
import { OrganizationService } from "../organization/service";
import { OrganizationRepository } from "../organization/repository";
import { AMLFetcherService } from "../regtank/aml-fetcher";
import {
  applyCorporateAmlMilestoneFromLiveKyb,
  applyPersonalAmlMilestoneFromLiveKyc,
} from "../regtank/webhooks/org-aml-milestone";
import { shouldApplyCodApprovedOnboardingFlag } from "../regtank/helpers/cod-amendment-transition";
import { getIndividualWaitForApprovalUpdate } from "../regtank/helpers/individual-onboarding-transition";
import { RegTankService } from "../regtank/service";
import { normalizeRawStatus } from "@cashsouk/types";
import type { PortalType } from "../regtank/types";
import { extractCorporateEntities } from "../regtank/helpers/extract-corporate-entities";
import { extractGovernmentIdFromCorporateUserInfo } from "../regtank/helpers/extract-government-id";
import { resolveCorporatePersonMergeKey } from "../regtank/helpers/corporate-person-merge-key";
import { buildAdminPeopleList, buildDirectorShareholderPeopleList } from "./build-people-list";
import { notifyIssuerDirectorShareholderActionRequired } from "../notification/director-shareholder-notifications";
import {
  APPLICATION_AUDIT_TARGET_TYPE,
  adminApplicationAuditContext,
  writeApplicationAuditLog,
} from "../applications/audit/writer";

export interface AdminLogContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
}
import { ProductRepository } from "../products/repository";
import { resolveRequestedFacility } from "../../lib/contract-facility";
import { refreshContractFacilityValues } from "../../lib/refresh-contract-facility";
import { getS3ObjectBuffer } from "../../lib/s3/client";
import { computeSupportingDocumentsSectionStatus } from "../applications/supporting-documents-section-status";
import { computeInvoiceDetailsSectionStatus } from "../applications/invoice-details-section-status";
import { assertMaturityForSendInvoiceOffer } from "../products/validate-financial-config";
import { extractSubmittedAtFromWebhookPayloads } from "./extract-submitted-at";
import { ensureAdminRoleCatalog } from "../../lib/auth/rbac";
import { patchOfferAcceptance } from "../applications/offer-acceptance";
import {
  closeApplicationAsRejected,
  VOIDABLE_ENVELOPE_STATUSES,
} from "../applications/lifecycle-close";
import {
  acceptanceDeadlinePatchOnChangesRequested,
  buildOfferAcceptanceOnSend,
  signingDeadlinePatchOnApprove,
  signingDeadlinePatchOnExtend,
  SIGNING_ACTIVE,
} from "../../lib/phase-deadlines";
import {
  CONTRACT_OFFER_CEREMONY_APPLICATION_STATUSES,
  extractPrimaryOfferAcceptanceStatus,
  isExistingContractFinancing,
  resolveApplicationStatusFromOfferAcceptancePhase,
  resolveInvoiceCentricApplicationStatus,
} from "../applications/offer-application-status";
import { loadInheritedAcceptanceForExistingContract } from "../../lib/contract-originating-application";
import { signingService } from "../signing/service";

const APPLICATION_ACTION_REQUIRED_STATUSES = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.RESUBMITTED,
  ApplicationStatus.CONTRACT_PENDING,
  ApplicationStatus.CONTRACT_ACCEPTED,
  ApplicationStatus.INVOICE_ACCEPTED,
  ApplicationStatus.SIGNING_PENDING,
  ApplicationStatus.INVOICE_PENDING,
] as const;
const RESERVED_ADMIN_ROLE_KEYS = new Set<string>(SYSTEM_ADMIN_ROLE_KEYS);

type ResubmitComparisonAmendmentRemark = {
  scope: string;
  scope_key: string;
  remark: string;
  author_user_id: string;
  submitted_at: string | null;
};

function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isFinalApplicationStatusForAmlGuard(status: string | null | undefined): boolean {
  return status === ApplicationStatus.COMPLETED;
}

function guarantorNationalityIso2FromSourceData(sourceData: unknown): string | undefined {
  if (!isPlainObjectRecord(sourceData)) return undefined;
  const raw = sourceData.nationality ?? sourceData.nationality_code;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toUpperCase();
  return t.length === 2 ? t : undefined;
}

export class AdminService {
  private repository: AdminRepository;
  private regTankRepository: RegTankRepository;
  private regTankApiClient: RegTankAPIClient;
  private regTankService: RegTankService;
  private organizationRepository: OrganizationRepository;
  private notificationService: NotificationService;
  private productRepository: ProductRepository;

  /** Sections that are workflow-step-driven (financial is always required separately). */
  private static readonly WORKFLOW_REVIEW_SECTION_KEYS: ReadonlySet<string> = new Set(
    REVIEW_SECTION_ORDER.filter((section) => section !== "financial")
  );

  constructor() {
    this.repository = new AdminRepository();
    this.regTankRepository = new RegTankRepository();
    this.regTankApiClient = new RegTankAPIClient();
    this.regTankService = new RegTankService();
    this.organizationRepository = new OrganizationRepository();
    this.notificationService = new NotificationService();
    this.productRepository = new ProductRepository();
  }

  private extractRequestIdFromVerifyLink(verifyLink: string): string | null {
    try {
      const parsed = new URL(verifyLink);
      const requestId = parsed.searchParams.get("requestId");
      return typeof requestId === "string" && requestId.trim().length > 0 ? requestId.trim() : null;
    } catch {
      return null;
    }
  }

  private resolveCompanyRestartResponse(params: {
    response: { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown };
    organizationId: string | null;
    previousRequestId: string;
    portalType: string;
  }): { requestId: string; verifyLink: string; expiredIn: number } {
    const { response, organizationId, previousRequestId, portalType } = params;
    const responseRequestId =
      typeof response.requestId === "string" && response.requestId.trim().length > 0
        ? response.requestId.trim()
        : "";
    const verifyLink =
      typeof response.verifyLink === "string" && response.verifyLink.trim().length > 0
        ? response.verifyLink
        : "";
    const parsedVerifyLinkRequestId = verifyLink
      ? this.extractRequestIdFromVerifyLink(verifyLink)
      : null;

    if (!responseRequestId || !verifyLink || !parsedVerifyLinkRequestId) {
      logger.error(
        {
          organizationId,
          portalType,
          previousRequestId,
          responseRequestId: responseRequestId || null,
          parsedVerifyLinkRequestId,
          hasVerifyLink: Boolean(verifyLink),
          reason: "missing requestId/verifyLink or verifyLink requestId",
        },
        "Invalid admin company restart response from RegTank"
      );
      throw new AppError(
        503,
        "REGTANK_CORPORATE_RESPONSE_INVALID",
        "We could not verify your company onboarding response from RegTank. Please try again shortly."
      );
    }

    if (parsedVerifyLinkRequestId !== responseRequestId) {
      logger.error(
        {
          organizationId,
          portalType,
          previousRequestId,
          responseRequestId,
          parsedVerifyLinkRequestId,
          reason: "requestId mismatch between response and verifyLink",
        },
        "RegTank admin company restart response requestId mismatch"
      );
      throw new AppError(
        503,
        "REGTANK_CORPORATE_RESPONSE_MISMATCH",
        "We could not verify your company onboarding response from RegTank. Please try again shortly."
      );
    }

    const expiredIn = typeof response.expiredIn === "number" && Number.isFinite(response.expiredIn)
      ? response.expiredIn
      : 86400;

    return {
      requestId: responseRequestId,
      verifyLink,
      expiredIn,
    };
  }

  private sortAdminRolesCatalog(roles: AdminRoleConfigRecord[]): AdminRoleConfigRecord[] {
    return [...roles].sort((a, b) => {
      if (a.key === "SUPER_ADMIN") return -1;
      if (b.key === "SUPER_ADMIN") return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  private async countAdminRoleAssignments(): Promise<Map<string, number>> {
    const roleIdRows = await prisma.admin.groupBy({
      by: ["role_id"],
      _count: { _all: true },
    });

    const roleIds = roleIdRows
      .map((row) => row.role_id)
      .filter((roleId): roleId is string => roleId !== null);

    const roleConfigs = roleIds.length
      ? await prisma.adminRoleConfig.findMany({
          where: { id: { in: roleIds } },
          select: { id: true, key: true },
        })
      : [];

    const roleKeyById = new Map(roleConfigs.map((role) => [role.id, role.key]));
    const counts = new Map<string, number>();

    for (const row of roleIdRows) {
      if (!row.role_id) {
        continue;
      }

      const roleKey = roleKeyById.get(row.role_id);
      if (!roleKey) {
        continue;
      }

      counts.set(roleKey, row._count._all);
    }

    return counts;
  }

  private toAdminRoleConfigRecord(
    role: {
      id: string;
      key: string;
      name: string;
      description: string | null;
      badge_color: string;
      permissions: string[];
      is_system: boolean;
      is_editable: boolean;
    },
    memberCount: number
  ): AdminRoleConfigRecord {
    const isSystemRole = RESERVED_ADMIN_ROLE_KEYS.has(role.key);

    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      badgeColor: role.badge_color as AdminRoleBadgeColor,
      permissions: role.permissions.filter((permission): permission is AdminPermission =>
        ADMIN_PERMISSIONS.includes(permission as AdminPermission)
      ),
      isSystem: isSystemRole,
      isEditable: !isSystemRole,
      memberCount,
    };
  }

  async listAdminRoleConfigs(): Promise<{ roles: AdminRoleConfigRecord[] }> {
    await ensureAdminRoleCatalog(prisma);

    const [roles, roleCounts] = await Promise.all([
      this.repository.listAdminRoleConfigs(),
      this.countAdminRoleAssignments(),
    ]);

    return {
      roles: this.sortAdminRolesCatalog(
        roles.map((role) =>
          this.toAdminRoleConfigRecord(role, roleCounts.get(role.key) ?? 0)
        )
      ),
    };
  }

  private async requireAdminRoleConfig(roleKey: AdminRoleKey) {
    await ensureAdminRoleCatalog(prisma);

    const role = await this.repository.getAdminRoleConfigByKey(roleKey);
    if (!role) {
      throw new AppError(404, "NOT_FOUND", "Admin role not found");
    }

    return role;
  }

  private async getAdminRoleUsage(roleKey: AdminRoleKey) {
    const [assignedAdminCount, pendingInvitationCount] = await Promise.all([
      this.repository.countAdminsByRoleKey(roleKey),
      this.repository.countPendingInvitationsByRoleKey(roleKey),
    ]);

    return {
      assignedAdminCount,
      pendingInvitationCount,
    };
  }

  async updateAdminRolePermissions(
    req: Request,
    roleKey: string,
    data: UpdateAdminRolePermissionsInput,
    _updatedBy: string
  ): Promise<{ role: AdminRoleConfigRecord }> {
    await ensureAdminRoleCatalog(prisma);

    const role = await this.repository.getAdminRoleConfigByKey(roleKey);
    if (!role) {
      throw new AppError(404, "NOT_FOUND", "Admin role not found");
    }

    if (RESERVED_ADMIN_ROLE_KEYS.has(role.key)) {
      const nextPermissions = [...new Set(data.permissions)].sort();
      const currentPermissions = [...role.permissions].sort();

      if (JSON.stringify(nextPermissions) !== JSON.stringify(currentPermissions)) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "System role permissions cannot be edited"
        );
      }
    }

    const context = auditContextFromAdminRequest(req);
    const nextPermissions = [...new Set(data.permissions)];
    const permDiff = permissionDiff(role.permissions, nextPermissions);

    const updatedRole = await prisma.$transaction(async (tx) => {
      const updated = await tx.adminRoleConfig.update({
        where: { key: roleKey },
        data: { permissions: nextPermissions, badge_color: data.badgeColor },
      });
      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_ROLE_PERMISSIONS_UPDATED",
          context,
          subjectUserId: null,
          targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_ROLE,
          targetId: roleKey,
          metadata: {
            roleKey,
            roleName: updated.name,
            ...permDiff,
            previousPermissions: role.permissions,
            nextPermissions: updated.permissions,
            previousBadgeColor: role.badge_color,
            nextBadgeColor: updated.badge_color,
          },
        },
        tx
      );
      return updated;
    });
    const roleCounts = await this.countAdminRoleAssignments();

    return {
      role: this.toAdminRoleConfigRecord(
        updatedRole,
        roleCounts.get(updatedRole.key) ?? 0
      ),
    };
  }

  async createAdminRole(
    req: Request,
    data: CreateAdminRoleInput,
    _createdBy: string
  ): Promise<{ role: AdminRoleConfigRecord }> {
    await ensureAdminRoleCatalog(prisma);

    if (RESERVED_ADMIN_ROLE_KEYS.has(data.key)) {
      throw new AppError(400, "VALIDATION_ERROR", "System role keys are reserved");
    }

    const existingRole = await this.repository.getAdminRoleConfigByKey(data.key);
    if (existingRole) {
      throw new AppError(409, "CONFLICT", "An admin role with this key already exists");
    }

    const context = auditContextFromAdminRequest(req);
    const createdRole = await prisma.$transaction(async (tx) => {
      const created = await tx.adminRoleConfig.create({
        data: {
          key: data.key,
          name: data.name,
          description: data.description ?? null,
          badge_color: data.badgeColor,
          permissions: [],
          is_system: false,
          is_editable: true,
          is_default: false,
        },
      });
      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_ROLE_CREATED",
          context,
          subjectUserId: null,
          targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_ROLE,
          targetId: created.key,
          metadata: {
            roleKey: created.key,
            roleName: created.name,
            badgeColor: created.badge_color,
          },
        },
        tx
      );
      return created;
    });
    const roleCounts = await this.countAdminRoleAssignments();

    return {
      role: this.toAdminRoleConfigRecord(createdRole, roleCounts.get(createdRole.key) ?? 0),
    };
  }

  async deleteAdminRole(
    req: Request,
    roleKey: string,
    _deletedBy: string
  ): Promise<{ deletedRoleKey: AdminRoleKey }> {
    await ensureAdminRoleCatalog(prisma);

    const role = await this.repository.getAdminRoleConfigByKey(roleKey);
    if (!role) {
      throw new AppError(404, "NOT_FOUND", "Admin role not found");
    }

    if (RESERVED_ADMIN_ROLE_KEYS.has(role.key)) {
      throw new AppError(403, "FORBIDDEN", "This admin role cannot be deleted");
    }

    const usage = await this.getAdminRoleUsage(role.key as AdminRoleKey);
    if (usage.assignedAdminCount > 0 || usage.pendingInvitationCount > 0) {
      const usageMessages: string[] = [];

      if (usage.assignedAdminCount > 0) {
        usageMessages.push(
          `${usage.assignedAdminCount} admin${usage.assignedAdminCount === 1 ? "" : "s"}`
        );
      }

      if (usage.pendingInvitationCount > 0) {
        usageMessages.push(
          `${usage.pendingInvitationCount} pending invitation${
            usage.pendingInvitationCount === 1 ? "" : "s"
          }`
        );
      }

      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `This admin role is still in use by ${usageMessages.join(" and ")}.`,
        usage
      );
    }

    const context = auditContextFromAdminRequest(req);
    await prisma.$transaction(async (tx) => {
      await tx.adminRoleConfig.delete({ where: { key: role.key } });
      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_ROLE_DELETED",
          context,
          subjectUserId: null,
          targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_ROLE,
          targetId: role.key,
          metadata: {
            roleKey: role.key,
            roleName: role.name,
          },
        },
        tx
      );
    });

    return { deletedRoleKey: role.key as AdminRoleKey };
  }

  private async enrichApplicationNotificationPayload<T extends NotificationTypeId>(
    applicationId: string,
    payload: NotificationPayloads[T]
  ): Promise<NotificationPayloads[T]> {
    const record = payload as NotificationPayloads[T] & {
      applicationId?: string;
      displayReference?: string | null;
    };
    if (!record.applicationId) {
      return payload;
    }
    if (typeof record.displayReference === "string" && record.displayReference.trim().length > 0) {
      return payload;
    }
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { display_reference: true },
    });
    return {
      ...payload,
      displayReference: application?.display_reference ?? null,
    };
  }

  private async sendIssuerNotification<T extends NotificationTypeId>(
    applicationId: string,
    typeId: T,
    payload: NotificationPayloads[T],
    idempotencySuffix: string,
    options?: { platformOnly?: boolean; ensureTypesSeeded?: boolean }
  ) {
    const recipientUserIds = await getIssuerRecipientUserIdsForApplication(applicationId);
    if (recipientUserIds.length === 0) {
      logger.warn(
        { applicationId, typeId },
        "Skipping issuer notification: no owner/admin recipients on application org"
      );
      return;
    }

    if (options?.ensureTypesSeeded) {
      // Ensures newly added catalog rows (e.g. acceptance change) exist before create.
      await this.notificationService.seedNotificationTypes();
    }

    const send = options?.platformOnly
      ? this.notificationService.sendTypedPlatformOnly.bind(this.notificationService)
      : this.notificationService.sendTyped.bind(this.notificationService);

    const enrichedPayload = await this.enrichApplicationNotificationPayload(applicationId, payload);

    const results = await Promise.all(
      recipientUserIds.map((userId) =>
        send(
          userId,
          typeId,
          enrichedPayload,
          `app:${applicationId}:notif:${String(typeId)}:user:${userId}:${idempotencySuffix}`
        )
      )
    );

    logger.info(
      {
        applicationId,
        typeId,
        recipientCount: recipientUserIds.length,
        createdCount: results.filter(Boolean).length,
        platformOnly: options?.platformOnly === true,
      },
      "Issuer notification dispatched"
    );
  }

  /**
   * Recompute revolving occupancy (live utilized, pending, repaid) on contract_details.
   * approved_facility is non-zero only when contract is APPROVED and issuer accepted the offer.
   */
  private async refreshContractFacilityValues(contractId: string): Promise<void> {
    await refreshContractFacilityValues(contractId);
  }

  private ensureContractOfferActionAllowed(
    application: { contract_id?: string | null; contract?: { status?: string | null } | null }
  ): void {
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
    }
    if (application.contract?.status === "APPROVED") {
      throw new AppError(
        400,
        "OFFER_FINALIZED",
        "Facility offer was finalized by issuer and cannot be modified"
      );
    }
  }

  /**
   * Once the issuer has acknowledged terms or acceptance moved past PENDING_ISSUER,
   * revise via retract → new offer (do not rebuild over accepted terms).
   */
  private assertOfferAcceptanceAllowsResend(offerDetails: unknown): void {
    const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
    if (!isOfferAcceptanceResendBlocked(acceptance)) return;
    throw new AppError(
      400,
      "OFFER_ACCEPTANCE_IN_PROGRESS",
      "Offer acceptance has already started. Retract this offer before sending revised terms."
    );
  }

  /** Block offer/acceptance mutations while a draft or in-flight signing package exists. */
  private async assertNoActiveSigningPackage(
    applicationId: string,
    target: { contractId?: string | null; invoiceId?: string | null },
    actionLabel: string
  ): Promise<void> {
    const envelope = await prisma.signingEnvelope.findFirst({
      where: {
        application_id: applicationId,
        status: { in: ["DRAFT", "SENT", "IN_PROGRESS"] },
        ...(target.contractId ? { contract_id: target.contractId } : {}),
        ...(target.invoiceId ? { invoice_id: target.invoiceId } : {}),
      },
      select: { id: true, status: true },
    });
    if (envelope) {
      throw new AppError(
        400,
        "ACTIVE_SIGNING_PACKAGE",
        `Void the active signing package before ${actionLabel}.`
      );
    }
  }

  /** Reset acceptance review items/section so a new offer version cannot reuse stale approvals. */
  private async resetAcceptanceReviewForNewOfferInTx(
    tx: Prisma.TransactionClient,
    applicationId: string,
    application: {
      acceptance_documents?: unknown;
    },
    workflow: unknown[]
  ): Promise<void> {
    const docKeys = collectAcceptanceDocumentReviewKeys(
      workflow,
      application.acceptance_documents
    );
    for (const itemId of docKeys) {
      await tx.applicationReviewItem.upsert({
        where: {
          application_id_item_type_item_id: {
            application_id: applicationId,
            item_type: "document",
            item_id: itemId,
          },
        },
        create: {
          application_id: applicationId,
          item_type: "document",
          item_id: itemId,
          status: ReviewStepStatus.PENDING,
          reviewer_user_id: null,
          reviewed_at: null,
        },
        update: {
          status: ReviewStepStatus.PENDING,
          reviewer_user_id: null,
          reviewed_at: null,
        },
      });
    }
    if (docKeys.length === 0 && !workflowHasAcceptanceDocuments(workflow)) {
      return;
    }
    await tx.applicationReview.upsert({
      where: {
        application_id_section: {
          application_id: applicationId,
          section: "acceptance_documents",
        },
      },
      create: {
        application_id: applicationId,
        section: "acceptance_documents",
        status: ReviewStepStatus.PENDING,
        reviewer_user_id: null,
        reviewed_at: null,
      },
      update: {
        status: ReviewStepStatus.PENDING,
        reviewer_user_id: null,
        reviewed_at: null,
      },
    });
  }

  private async ensureInvoiceOfferItemActionAllowed(
    applicationId: string,
    itemScopeKey: string,
    application: { invoices?: { id: string; details?: unknown }[] }
  ): Promise<void> {
    const invoiceId = this.resolveInvoiceIdFromScopeKey(
      application as { invoices?: { id: string; details?: { number?: string | number } }[] },
      itemScopeKey
    );
    if (!invoiceId) {
      throw new AppError(400, "INVALID_INPUT", "Unable to resolve invoice from scope key");
    }
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, application_id: applicationId },
      select: { status: true },
    });
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found");
    }
    if (invoice.status === "APPROVED") {
      throw new AppError(
        400,
        "OFFER_FINALIZED",
        "Invoice offer was finalized by issuer and cannot be modified"
      );
    }
  }

  private async ensureInvoiceSectionActionAllowed(applicationId: string): Promise<void> {
    const approvedCount = await prisma.invoice.count({
      where: { application_id: applicationId, status: "APPROVED" },
    });
    if (approvedCount > 0) {
      throw new AppError(
        400,
        "OFFER_FINALIZED",
        "Invoice offer was finalized by issuer and section-level actions are locked"
      );
    }
  }

  /**
   * Build section policy for review UI and finalization checks.
   * - requiredSections: must be APPROVED before application final approval
   * - visibleSections: sections that should be shown in admin review tabs
   * - prerequisitesBySection: lock dependencies for each section
   */
  private async getReviewSectionPolicy(application: {
    financing_type?: unknown;
    financing_structure?: unknown;
    product_version?: number | null;
  }): Promise<{
    requiredSections: Set<ReviewSection>;
    visibleSections: Set<ReviewSection>;
    prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>>;
    /** Frozen product.workflow for application.product_version (null when unresolved). */
    productWorkflow: unknown[] | null;
  }> {
    const requiredSections = new Set<ReviewSection>(["financial"]);
    const financingType =
      application.financing_type && typeof application.financing_type === "object"
        ? (application.financing_type as Record<string, unknown>)
        : null;
    const productId = typeof financingType?.product_id === "string" ? financingType.product_id : null;

    const structureType =
      application.financing_structure && typeof application.financing_structure === "object"
        ? ((application.financing_structure as Record<string, unknown>).structure_type as
            | string
            | undefined)
        : undefined;
    const prerequisitesBySection = getReviewSectionPrerequisites(structureType);
    const sectionOrder = getReviewSectionOrder(structureType);

    if (!productId) {
      const fallback = new Set(sectionOrder);
      return {
        requiredSections: fallback,
        visibleSections: new Set(fallback),
        prerequisitesBySection,
        productWorkflow: null,
      };
    }

    // Use frozen application.product_version so Acceptance visibility matches issuer + sync.
    const product =
      application.product_version != null
        ? await this.productRepository.findByBaseAndVersion(productId, application.product_version)
        : await this.productRepository.findById(productId);
    if (!product) {
      const fallback = new Set(sectionOrder);
      return {
        requiredSections: fallback,
        visibleSections: new Set(fallback),
        prerequisitesBySection,
        productWorkflow: null,
      };
    }

    const workflow = Array.isArray(product.workflow) ? product.workflow : [];
    for (const rawStep of workflow) {
      const step = rawStep as { id?: unknown };
      const stepId = typeof step.id === "string" ? step.id : "";
      if (!stepId) continue;
      const stepKey = getStepKeyFromStepId(stepId);
      if (!stepKey) continue;
      if (stepKey === "financial_statements") {
        requiredSections.add("financial");
        continue;
      }
      if (!AdminService.WORKFLOW_REVIEW_SECTION_KEYS.has(stepKey)) continue;
      requiredSections.add(stepKey as ReviewSection);
    }

    const visibleSections = new Set(requiredSections);
    if (
      shouldShowAcceptanceDocumentsReviewSection(
        structureType,
        workflowShowsAcceptanceReviewSection(workflow)
      )
    ) {
      visibleSections.add("acceptance_documents");
    }
    return {
      requiredSections,
      visibleSections,
      prerequisitesBySection,
      productWorkflow: workflow,
    };
  }

  /**
   * List users with pagination and filters
   */
  async listUsers(params: GetUsersQuery): Promise<{
    users: User[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { users, total } = await this.repository.getUsers(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      users,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.repository.getUserById(userId);
  }

  async getUserDetail(userId: string): Promise<UserDetailResponse | null> {
    const [user, investorOrganizations, issuerOrganizations] = await Promise.all([
      prisma.user.findUnique({
        where: { user_id: userId },
        include: {
          _count: {
            select: {
              investments: true,
              loans: true,
            },
          },
        },
      }),
      prisma.investorOrganization.findMany({
        where: {
          OR: [
            { owner_user_id: userId },
            { members: { some: { user_id: userId } } },
          ],
        },
        orderBy: { updated_at: "desc" },
        select: {
          id: true,
          owner_user_id: true,
          type: true,
          name: true,
          registration_number: true,
          onboarding_status: true,
          onboarded_at: true,
          created_at: true,
          updated_at: true,
          is_sophisticated_investor: true,
          members: {
            where: { user_id: userId },
            select: { role: true },
            take: 1,
          },
          _count: { select: { members: true } },
        },
      }),
      prisma.issuerOrganization.findMany({
        where: {
          OR: [
            { owner_user_id: userId },
            { members: { some: { user_id: userId } } },
          ],
        },
        orderBy: { updated_at: "desc" },
        select: {
          id: true,
          owner_user_id: true,
          type: true,
          name: true,
          registration_number: true,
          onboarding_status: true,
          onboarded_at: true,
          created_at: true,
          updated_at: true,
          members: {
            where: { user_id: userId },
            select: { role: true },
            take: 1,
          },
          _count: { select: { members: true } },
        },
      }),
    ]);

    if (!user) {
      return null;
    }

    const mapOrganization = (
      org: {
        id: string;
        owner_user_id: string;
        type: OrganizationType;
        name: string | null;
        registration_number: string | null;
        onboarding_status: OnboardingStatus;
        onboarded_at: Date | null;
        created_at: Date;
        updated_at: Date;
        is_sophisticated_investor?: boolean;
        members: { role: string }[];
        _count: { members: number };
      },
      portal: "investor" | "issuer"
    ) => ({
      id: org.id,
      portal,
      type: org.type,
      name: org.name,
      registrationNumber: org.registration_number,
      onboardingStatus: org.onboarding_status,
      onboardedAt: org.onboarded_at?.toISOString() ?? null,
      relationship: org.owner_user_id === userId ? "owner" as const : "member" as const,
      memberRole: org.members[0]?.role ?? null,
      memberCount: org._count.members,
      isSophisticatedInvestor: org.is_sophisticated_investor ?? false,
      createdAt: org.created_at.toISOString(),
      updatedAt: org.updated_at.toISOString(),
    });

    return {
      user_id: user.user_id,
      email: user.email,
      email_verified: user.email_verified,
      cognito_sub: user.cognito_sub,
      cognito_username: user.cognito_username,
      roles: user.roles,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      investor_account: user.investor_account,
      issuer_account: user.issuer_account,
      investor_organization_count: investorOrganizations.length,
      issuer_organization_count: issuerOrganizations.length,
      password_changed_at: user.password_changed_at?.toISOString() ?? null,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString(),
      stats: {
        accessLogs: await accessAuditLogReader.countForUser(user.user_id),
        investments: user._count.investments,
        loans: user._count.loans,
        investorOrganizations: investorOrganizations.length,
        issuerOrganizations: issuerOrganizations.length,
      },
      organizations: {
        investor: investorOrganizations.map((org) => mapOrganization(org, "investor")),
        issuer: issuerOrganizations.map((org) => mapOrganization(org, "issuer")),
      },
    };
  }

  /**
   * Update user roles
   */
  async updateUserRoles(
    req: Request,
    userId: string,
    data: UpdateUserRolesInput,
    adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if ADMIN role is being added or removed
    const hadAdminRole = user.roles.includes(UserRole.ADMIN);
    const hasAdminRole = data.roles.includes(UserRole.ADMIN);
    const adminRoleRemoved = hadAdminRole && !hasAdminRole;
    const adminRoleAdded = !hadAdminRole && hasAdminRole;

    const context = auditContextFromAdminRequest(req);
    const diff = roleDiff(user.roles, data.roles);

    const updatedUser = await prisma.$transaction(async (tx) => {
      if (adminRoleRemoved) {
        const admin = await tx.admin.findUnique({ where: { user_id: userId } });
        if (admin && admin.status === "ACTIVE") {
          logger.info(
            { userId, email: user.email, deactivatedBy: adminUserId },
            "ADMIN role removed - deactivating admin record"
          );
          await tx.admin.update({
            where: { user_id: userId },
            data: { status: "INACTIVE" },
          });
          await writeSecurityAuditLog(
            {
              eventType: "ADMIN_USER_DEACTIVATED",
              context,
              subjectUserId: userId,
              targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
              targetId: userId,
              metadata: {
                previousStatus: "ACTIVE",
                newStatus: "INACTIVE",
                previousRoles: user.roles,
                newRoles: data.roles,
              },
            },
            tx
          );
        }
      }

      if (adminRoleAdded) {
        const admin = await tx.admin.findUnique({ where: { user_id: userId } });
        if (admin) {
          if (admin.status === "INACTIVE") {
            logger.info(
              {
                userId,
                email: user.email,
                roleDescription: admin.role_description,
                activatedBy: adminUserId,
              },
              "ADMIN role added - reactivating existing admin record with previous role description"
            );
            await tx.admin.update({
              where: { user_id: userId },
              data: { status: "ACTIVE" },
            });
            await writeSecurityAuditLog(
              {
                eventType: "ADMIN_USER_REACTIVATED",
                context,
                subjectUserId: userId,
                targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
                targetId: userId,
                metadata: {
                  previousStatus: "INACTIVE",
                  newStatus: "ACTIVE",
                  previousRoles: user.roles,
                  newRoles: data.roles,
                },
              },
              tx
            );
          }
        } else {
          logger.info(
            { userId, email: user.email, activatedBy: adminUserId },
            "ADMIN role added - creating new admin record with SUPER_ADMIN role"
          );
          const superAdminRole = await tx.adminRoleConfig.findUnique({
            where: { key: AdminRole.SUPER_ADMIN },
          });
          await tx.admin.create({
            data: {
              user_id: userId,
              role_id: superAdminRole?.id ?? null,
              role_description: AdminRole.SUPER_ADMIN,
              status: "ACTIVE",
            },
          });
        }
      }

      const hasInvestorRole = data.roles.includes(UserRole.INVESTOR);
      const hasIssuerRole = data.roles.includes(UserRole.ISSUER);
      const userUpdate: Prisma.UserUpdateInput = { roles: { set: data.roles } };
      if (!hasInvestorRole && user.investor_account.length > 0) {
        userUpdate.investor_account = { set: [] };
      }
      if (!hasIssuerRole && user.issuer_account.length > 0) {
        userUpdate.issuer_account = { set: [] };
      }

      const updated = await tx.user.update({
        where: { user_id: userId },
        data: userUpdate,
      });

      await writeSecurityAuditLog(
        {
          eventType: "USER_ROLES_UPDATED",
          context,
          subjectUserId: userId,
          targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
          targetId: userId,
          metadata: diff,
        },
        tx
      );

      return updated;
    });

    return updatedUser;
  }

  /**
   * Update user onboarding status
   */
  async updateUserOnboarding(
    req: Request,
    userId: string,
    data: UpdateUserOnboardingInput,
    _adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Manage roles based on onboarding status
    let updatedRoles = [...user.roles];

    // When setting onboarding to true, automatically add the role if not present
    if (data.investorOnboarded === true && !updatedRoles.includes(UserRole.INVESTOR)) {
      updatedRoles.push(UserRole.INVESTOR);
    }

    if (data.issuerOnboarded === true && !updatedRoles.includes(UserRole.ISSUER)) {
      updatedRoles.push(UserRole.ISSUER);
    }

    // When setting onboarding to false, remove the role
    if (data.investorOnboarded === false && updatedRoles.includes(UserRole.INVESTOR)) {
      updatedRoles = updatedRoles.filter((role) => role !== UserRole.INVESTOR);
    }

    if (data.issuerOnboarded === false && updatedRoles.includes(UserRole.ISSUER)) {
      updatedRoles = updatedRoles.filter((role) => role !== UserRole.ISSUER);
    }

    const rolesChanged = JSON.stringify(updatedRoles.sort()) !== JSON.stringify(user.roles.sort());
    const previousInvestorOnboarded = user.investor_account.length > 0;
    const previousIssuerOnboarded = user.issuer_account.length > 0;
    const context = auditContextFromAdminRequest(req);

    const [latestInvestorOrg, latestIssuerOrg] = await Promise.all([
      prisma.investorOrganization.findFirst({
        where: { owner_user_id: userId },
        orderBy: { updated_at: "desc" },
      }),
      prisma.issuerOrganization.findFirst({
        where: { owner_user_id: userId },
        orderBy: { updated_at: "desc" },
      }),
    ]);

    return prisma.$transaction(async (tx) => {
      const updatedUser = await this.repository.updateUserOnboarding(
        userId,
        data,
        rolesChanged ? updatedRoles : undefined,
        tx
      );

      if (
        data.investorOnboarded !== undefined &&
        data.investorOnboarded !== previousInvestorOnboarded
      ) {
        await writeOnboardingAuditLog(
          {
            eventType: "USER_ONBOARDING_STATUS_UPDATED",
            context,
            subjectUserId: userId,
            organizationId: latestInvestorOrg?.id ?? null,
            organizationKind: "INVESTOR",
            organizationType: latestInvestorOrg?.type ?? null,
            targetType: ONBOARDING_AUDIT_TARGET_TYPE.USER,
            targetId: userId,
            metadata: {
              portal: "investor",
              previousAccountMarker: user.investor_account,
              newAccountMarker: updatedUser.investor_account,
            },
          },
          tx
        );
      }

      if (data.issuerOnboarded !== undefined && data.issuerOnboarded !== previousIssuerOnboarded) {
        await writeOnboardingAuditLog(
          {
            eventType: "USER_ONBOARDING_STATUS_UPDATED",
            context,
            subjectUserId: userId,
            organizationId: latestIssuerOrg?.id ?? null,
            organizationKind: "ISSUER",
            organizationType: latestIssuerOrg?.type ?? null,
            targetType: ONBOARDING_AUDIT_TARGET_TYPE.USER,
            targetId: userId,
            metadata: {
              portal: "issuer",
              previousAccountMarker: user.issuer_account,
              newAccountMarker: updatedUser.issuer_account,
            },
          },
          tx
        );
      }

      return updatedUser;
    });
  }

  /**
   * Update user profile (name, phone)
   */
  async updateUserProfile(
    req: Request,
    userId: string,
    data: UpdateUserProfileInput,
    _adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const context = auditContextFromAdminRequest(req);
    const before = {
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
    };

    return prisma.$transaction(async (tx) => {
      const updateData: Record<string, string | null> = {};
      if (data.firstName !== undefined) updateData.first_name = data.firstName;
      if (data.lastName !== undefined) updateData.last_name = data.lastName;
      if (data.phone !== undefined) updateData.phone = data.phone;

      const updatedUser = await tx.user.update({
        where: { user_id: userId },
        data: updateData,
      });

      const after = {
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
      };
      const changedFields = changedFieldsOf(before, after);
      if (changedFields.length > 0) {
        await writeSecurityAuditLog(
          {
            eventType: "USER_PROFILE_UPDATED_BY_ADMIN",
            context,
            subjectUserId: userId,
            targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
            targetId: userId,
            metadata: { changedFields, before, after },
          },
          tx
        );
      }

      return updatedUser;
    });
  }

  /**
   * List access logs with pagination and filters
   */
  async listAccessLogs(params: GetAccessLogsQuery): Promise<{
    logs: Awaited<ReturnType<typeof accessAuditLogReader.findAll>>["logs"];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { logs, total } = await accessAuditLogReader.findAll(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      logs,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  async getAccessLogById(logId: string) {
    return accessAuditLogReader.findById(logId);
  }

  async exportAccessLogs(params: Omit<GetAccessLogsQuery, "page" | "pageSize">) {
    return accessAuditLogReader.findAllForExport(params);
  }

  /**
   * Get dashboard statistics including user counts, trends, and percentage changes
   */
  async getDashboardStats(): Promise<{
    users: {
      total: { current: number; previous: number; percentageChange: number };
      investorsOnboarded: { current: number; previous: number; percentageChange: number };
      issuersOnboarded: { current: number; previous: number; percentageChange: number };
    };
    signupTrends: {
      date: string;
      totalSignups: number;
      investorOrgsOnboarded: number;
      issuerOrgsOnboarded: number;
    }[];
    organizations: {
      investor: {
        total: number;
        personal: { total: number; onboarded: number; pending: number };
        company: { total: number; onboarded: number; pending: number };
      };
      issuer: {
        total: number;
        personal: { total: number; onboarded: number; pending: number };
        company: { total: number; onboarded: number; pending: number };
      };
    };
    onboardingOperations: {
      inProgress: number;
      pending: number;
      approved: number;
      rejected: number;
      expired: number;
    };
    applicationMetrics: {
      total: number;
      actionRequired: number;
      draft: number;
      contractOrAmendmentCycle: number;
      approvedCompleted: number;
      withdrawnRejectedOrArchived: number;
    };
    contractMetrics: {
      total: number;
      actionRequired: number;
      draft: number;
      offerSent: number;
      approved: number;
      rejectedOrWithdrawn: number;
    };
    noteMetrics: {
      total: number;
      draft: number;
      live: number;
      repaid: number;
      distressed: number;
      cancelledOrFailedFunding: number;
    };
  }> {
    const TREND_PERIOD_DAYS = 30;

    // Get all stats in parallel
    const [
      totalStats,
      currentPeriodStats,
      previousPeriodStats,
      signupTrends,
      organizationStats,
      onboardingOperations,
      applicationMetrics,
      contractMetrics,
      noteMetrics,
    ] = await Promise.all([
      this.repository.getUserStats(),
      this.repository.getCurrentPeriodStats(TREND_PERIOD_DAYS),
      this.repository.getPreviousPeriodStats(TREND_PERIOD_DAYS),
      this.repository.getSignupTrends(TREND_PERIOD_DAYS),
      this.repository.getOrganizationStats(),
      this.repository.getOnboardingOperationsMetrics(),
      this.repository.getApplicationDashboardMetrics(),
      this.repository.getContractDashboardMetrics(),
      this.repository.getNoteDashboardMetrics(),
    ]);

    // Calculate percentage changes
    const calculatePercentageChange = (current: number, previous: number): number => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      users: {
        total: {
          current: totalStats.totalUsers,
          previous:
            totalStats.totalUsers - currentPeriodStats.totalUsers + previousPeriodStats.totalUsers,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.totalUsers,
            previousPeriodStats.totalUsers
          ),
        },
        investorsOnboarded: {
          current: totalStats.investorsOnboarded,
          previous:
            totalStats.investorsOnboarded -
            currentPeriodStats.investorsOnboarded +
            previousPeriodStats.investorsOnboarded,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.investorsOnboarded,
            previousPeriodStats.investorsOnboarded
          ),
        },
        issuersOnboarded: {
          current: totalStats.issuersOnboarded,
          previous:
            totalStats.issuersOnboarded -
            currentPeriodStats.issuersOnboarded +
            previousPeriodStats.issuersOnboarded,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.issuersOnboarded,
            previousPeriodStats.issuersOnboarded
          ),
        },
      },
      signupTrends,
      organizations: organizationStats,
      onboardingOperations,
      applicationMetrics,
      contractMetrics,
      noteMetrics,
    };
  }

  /**
   * Update user's 5-letter ID (admin only)
   */
  async updateUserId(
    req: Request,
    userId: string,
    newUserId: string
  ): Promise<{ user_id: string }> {
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const context = auditContextFromAdminRequest(req);

    try {
      return await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { user_id: userId },
          data: { user_id: newUserId },
        });

        await writeSecurityAuditLog(
          {
            eventType: "USER_PUBLIC_ID_CHANGED",
            context,
            subjectUserId: newUserId,
            targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
            targetId: newUserId,
            metadata: {
              previousUserId: userId,
              newUserId,
            },
          },
          tx
        );

        return { user_id: updatedUser.user_id };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new AppError(409, "CONFLICT", "This User ID is already assigned to another user");
      }
      throw error;
    }
  }

  /**
   * Get admin users list
   */
  async getAdminUsers(params: GetAdminUsersQuery): Promise<{
    users: (User & {
      admin: { role_description: string; status: string; last_login: Date | null } | null;
    })[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { users, total } = await this.repository.getAdminUsers(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      users,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  /**
   * Update admin role description
   */
  async updateAdminRole(
    req: Request,
    userId: string,
    data: UpdateAdminRoleInput,
    _updatedBy: string
  ): Promise<User & { admin: { role_description: string } | null }> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    if (!user.roles.includes(UserRole.ADMIN)) {
      throw new AppError(400, "VALIDATION_ERROR", "User is not an admin");
    }

    const admin = await this.repository.getAdminByUserId(userId);
    if (!admin) {
      throw new AppError(404, "NOT_FOUND", "Admin record not found");
    }

    await this.requireAdminRoleConfig(data.roleDescription);

    const previousRole = admin.role_description;

    if (
      previousRole === AdminRole.SUPER_ADMIN &&
      data.roleDescription !== AdminRole.SUPER_ADMIN
    ) {
      const activeSuperAdminCount = await this.repository.countActiveSuperAdmins();
      if (activeSuperAdminCount <= 1) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "At least one active Super Admin must remain. Assign another Super Admin before changing this role."
        );
      }
    }

    const context = auditContextFromAdminRequest(req);
    const roleConfig = await this.requireAdminRoleConfig(data.roleDescription);

    await prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { user_id: userId },
        data: {
          role_id: roleConfig.id,
          role_description: data.roleDescription,
        },
      });
      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_USER_ROLE_CHANGED",
          context,
          subjectUserId: userId,
          targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
          targetId: userId,
          metadata: {
            previousRole,
            newRole: data.roleDescription,
          },
        },
        tx
      );
    });

    const updatedUser = await this.repository.getUserById(userId);
    const updatedAdmin = await this.repository.getAdminByUserId(userId);

    return {
      ...updatedUser!,
      admin: updatedAdmin,
    } as User & { admin: { role_description: string } | null };
  }

  /**
   * Deactivate admin - removes ADMIN role and sets status to INACTIVE
   * Creates admin record if it doesn't exist (for users with ADMIN role but no admin record)
   * Removes ADMIN role from user.roles to sync with /users page
   * User will not be able to access admin portal until reactivated
   */
  async deactivateAdmin(req: Request, userId: string, deactivatedBy: string): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Check if admin record exists
    let admin = await this.repository.getAdminByUserId(userId);

    // If no admin record exists, create one with SUPER_ADMIN as default role
    // This handles cases where users have ADMIN role but no admin record
    if (!admin) {
      logger.info(
        { userId, email: user.email, deactivatedBy },
        "Admin record not found - creating new admin record with SUPER_ADMIN role before deactivation"
      );
      admin = await this.repository.createAdmin(userId, AdminRole.SUPER_ADMIN);
      // Admin record is created with ACTIVE status by default, so we'll deactivate it below
    } else if (admin.status === "INACTIVE") {
      throw new AppError(400, "VALIDATION_ERROR", "Admin is already deactivated");
    }

    if (admin.role_description === AdminRole.SUPER_ADMIN) {
      const activeSuperAdminCount = await this.repository.countActiveSuperAdmins();
      if (activeSuperAdminCount <= 1) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "At least one active Super Admin must remain. Assign another Super Admin before deactivating this user."
        );
      }
    }

    const context = auditContextFromAdminRequest(req);
    const previousRoles = user.roles;
    const newRoles = user.roles.filter((role) => role !== UserRole.ADMIN);

    await prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { user_id: userId },
        data: { status: "INACTIVE" },
      });
      if (user.roles.includes(UserRole.ADMIN)) {
        logger.info(
          { userId, email: user.email, deactivatedBy },
          "Removing ADMIN role from user.roles to sync with /users page"
        );
        await tx.user.update({
          where: { user_id: userId },
          data: { roles: { set: newRoles } },
        });
      }
      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_USER_DEACTIVATED",
          context,
          subjectUserId: userId,
          targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
          targetId: userId,
          metadata: {
            previousStatus: "ACTIVE",
            newStatus: "INACTIVE",
            previousRoles,
            newRoles: user.roles.includes(UserRole.ADMIN) ? newRoles : previousRoles,
          },
        },
        tx
      );
    });

    return this.repository.getUserById(userId) as Promise<User>;
  }

  /**
   * Reactivate admin - sets status back to ACTIVE and adds ADMIN role
   * Creates admin record if it doesn't exist (for users with ADMIN role but no admin record)
   * Adds ADMIN role to user.roles to sync with /users page
   */
  async reactivateAdmin(req: Request, userId: string, reactivatedBy: string): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const admin = await this.repository.getAdminByUserId(userId);
    if (admin?.status === "ACTIVE") {
      throw new AppError(400, "VALIDATION_ERROR", "Admin is already active");
    }

    const context = auditContextFromAdminRequest(req);
    const previousRoles = user.roles;
    const newRoles = user.roles.includes(UserRole.ADMIN)
      ? user.roles
      : [...user.roles, UserRole.ADMIN];

    await prisma.$transaction(async (tx) => {
      if (!user.roles.includes(UserRole.ADMIN)) {
        logger.info(
          { userId, email: user.email, reactivatedBy },
          "Adding ADMIN role to user.roles to sync with /users page"
        );
        await tx.user.update({
          where: { user_id: userId },
          data: { roles: { set: newRoles } },
        });
      }

      if (!admin) {
        logger.info(
          { userId, email: user.email, reactivatedBy },
          "Admin record not found - creating new admin record with SUPER_ADMIN role"
        );
        const superAdminRole = await tx.adminRoleConfig.findUnique({
          where: { key: AdminRole.SUPER_ADMIN },
        });
        await tx.admin.create({
          data: {
            user_id: userId,
            role_id: superAdminRole?.id ?? null,
            role_description: AdminRole.SUPER_ADMIN,
            status: "ACTIVE",
          },
        });
      } else {
        await tx.admin.update({
          where: { user_id: userId },
          data: { status: "ACTIVE" },
        });
      }

      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_USER_REACTIVATED",
          context,
          subjectUserId: userId,
          targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
          targetId: userId,
          metadata: {
            previousStatus: admin?.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
            newStatus: "ACTIVE",
            previousRoles,
            newRoles,
          },
        },
        tx
      );
    });

    return this.repository.getUserById(userId) as Promise<User>;
  }

  /**
   * Generate invitation URL without sending email
   */
  async generateInvitationUrl(
    req: Request,
    data: InviteAdminInput,
    invitedBy: string,
    options?: { writeLinkGenerated?: boolean }
  ): Promise<{
    inviteUrl: string;
    token: string;
    invitationId: string;
    email: string;
    expiresAt: Date;
    created: boolean;
  }> {
    const inviter = await this.repository.getUserById(invitedBy);
    if (!inviter) {
      throw new AppError(404, "NOT_FOUND", "Inviter not found");
    }

    await this.requireAdminRoleConfig(data.roleDescription);

    const email = data.email?.toLowerCase() || `invitation-${Date.now()}@cashsouk.com`;
    const context = auditContextFromAdminRequest(req);

    const existingInvitation = await prisma.adminInvitation.findFirst({
      where: {
        email,
        role_description: data.roleDescription,
        accepted: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    const invitation = existingInvitation
      ? existingInvitation
      : await prisma.$transaction(async (tx) => {
          const token = randomBytes(32).toString("hex");
          const expiryHours = parseInt(process.env.INVITATION_TOKEN_EXPIRY_HOURS || "24", 10);
          const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
          const created = await tx.adminInvitation.create({
            data: {
              email,
              role_description: data.roleDescription,
              token,
              expires_at: expiresAt,
              invited_by_user_id: invitedBy,
            },
          });
          await writeSecurityAuditLog(
            {
              eventType: "ADMIN_INVITATION_CREATED",
              context,
              subjectUserId: null,
              targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_INVITATION,
              targetId: created.id,
              metadata: {
                invitationId: created.id,
                email: created.email,
                role: created.role_description,
                expiresAt: created.expires_at.toISOString(),
              },
            },
            tx
          );
          return created;
        });

    if (options?.writeLinkGenerated) {
      await writeSecurityAuditLog({
        eventType: "ADMIN_INVITATION_LINK_GENERATED",
        context,
        subjectUserId: null,
        targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_INVITATION,
        targetId: invitation.id,
        metadata: {
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role_description,
          expiresAt: invitation.expires_at.toISOString(),
        },
      });
    }

    const adminPortalUrl = process.env.ADMIN_URL || "http://localhost:3003";
    const inviteUrl = `${adminPortalUrl}/callback?invitation=${invitation.token}&role=${data.roleDescription}`;

    return {
      inviteUrl,
      token: invitation.token,
      invitationId: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expires_at,
      created: !existingInvitation,
    };
  }

  /**
   * Invite admin user (sends email if email provided)
   */
  async inviteAdmin(
    req: Request,
    data: InviteAdminInput,
    invitedBy: string
  ): Promise<{ inviteUrl: string; messageId?: string; emailSent: boolean; emailError?: string }> {
    const inviter = await this.repository.getUserById(invitedBy);
    if (!inviter) {
      throw new AppError(404, "NOT_FOUND", "Inviter not found");
    }

    const invitedRole = await this.requireAdminRoleConfig(data.roleDescription);

    // Generate invitation URL (creates invitation record if needed)
    const { inviteUrl } = await this.generateInvitationUrl(req, data, invitedBy);

    // Send email via SES only if email is provided
    let messageId: string | undefined;
    let emailSent = false;
    let emailError: string | undefined;

    if (data.email) {
      try {
        const inviterName = `${inviter.first_name} ${inviter.last_name}`;
        const template = adminInvitationTemplate(
          inviteUrl,
          {
            key: invitedRole.key as AdminRoleKey,
            name: invitedRole.name,
            description: invitedRole.description,
          },
          inviterName
        );

        const result = await sendEmail({
          to: data.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        messageId = result.messageId;
        emailSent = true;

        logger.info(
          {
            email: data.email,
            roleDescription: data.roleDescription,
            invitedBy,
            messageId,
          },
          "Admin invitation sent via email"
        );
      } catch (error) {
        // Log error but don't fail the request - invitation link is still valid
        emailSent = false;
        emailError = error instanceof Error ? error.message : String(error);

        logger.warn(
          {
            email: data.email,
            roleDescription: data.roleDescription,
            invitedBy,
            error: emailError,
          },
          "Failed to send admin invitation email, but invitation link is still valid"
        );
        // Continue without messageId - the invitation URL is still returned
      }
    } else {
      logger.info(
        {
          roleDescription: data.roleDescription,
          invitedBy,
        },
        "Admin invitation link generated (no email sent)"
      );
    }

    return { inviteUrl, messageId, emailSent, ...(emailError && { emailError }) };
  }

  /**
   * Accept admin invitation
   * For link-based invitations (no email), user must be provided (from authenticated session)
   * For email-based invitations, user is found by email
   */
  async acceptInvitation(
    req: Request,
    data: AcceptInvitationInput,
    authenticatedUser?: User
  ): Promise<{
    user: User;
    admin: { role_description: string; status: "ACTIVE" | "INACTIVE" };
  }> {
    const invitation = await this.repository.getAdminInvitationByToken(data.token);

    if (!invitation) {
      throw new AppError(404, "NOT_FOUND", "Invitation not found");
    }

    if (invitation.accepted) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has already been accepted");
    }

    if (new Date() > invitation.expires_at) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has expired");
    }

    await this.requireAdminRoleConfig(invitation.role_description);

    // Find user - if invitation has a placeholder email, use authenticated user
    // Otherwise, find by invitation email
    let user: User | null = null;

    if (invitation.email.startsWith("invitation-") && invitation.email.includes("@cashsouk.com")) {
      // This is a link-based invitation - use authenticated user from OAuth callback
      if (!authenticatedUser) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Link-based invitations require authentication"
        );
      }
      user = authenticatedUser;
    } else {
      // Email-based invitation - find user by email
      user = await prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        throw new AppError(404, "NOT_FOUND", "User not found. Please sign up first.");
      }
    }

    const context = auditContextFromRequest(req, {
      actorType: AUDIT_ACTOR_TYPE.ADMIN,
      actorUserId: user.user_id,
      portal: AUDIT_PORTAL.ADMIN,
      source: AUDIT_SOURCE.API,
    });

    const { updatedUser, admin } = await prisma.$transaction(async (tx) => {
      const updatedRoles = [...user.roles];
      if (!updatedRoles.includes(UserRole.ADMIN)) {
        updatedRoles.push(UserRole.ADMIN);
        await tx.user.update({
          where: { user_id: user.user_id },
          data: { roles: { set: updatedRoles } },
        });
      }

      let adminRecord = await tx.admin.findUnique({ where: { user_id: user.user_id } });
      if (!adminRecord) {
        const roleConfig = await tx.adminRoleConfig.findUnique({
          where: { key: invitation.role_description },
        });
        adminRecord = await tx.admin.create({
          data: {
            user_id: user.user_id,
            role_id: roleConfig?.id ?? null,
            role_description: invitation.role_description,
            status: "ACTIVE",
          },
        });
      } else {
        const adminUpdate: { role_id?: string | null; role_description?: string; status?: "ACTIVE" | "INACTIVE" } =
          {};
        if (adminRecord.role_description !== invitation.role_description) {
          const roleConfig = await tx.adminRoleConfig.findUnique({
            where: { key: invitation.role_description },
          });
          adminUpdate.role_id = roleConfig?.id ?? null;
          adminUpdate.role_description = invitation.role_description;
        }
        if (adminRecord.status !== "ACTIVE") {
          adminUpdate.status = "ACTIVE";
        }
        if (Object.keys(adminUpdate).length > 0) {
          adminRecord = await tx.admin.update({
            where: { user_id: user.user_id },
            data: adminUpdate,
          });
        }
      }

      await tx.adminInvitation.update({
        where: { token: data.token },
        data: {
          accepted: true,
          accepted_at: new Date(),
        },
      });

      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_INVITATION_ACCEPTED",
          context,
          subjectUserId: user.user_id,
          targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_INVITATION,
          targetId: invitation.id,
          metadata: {
            invitationId: invitation.id,
            email: user.email,
            role: invitation.role_description,
            expiresAt: invitation.expires_at.toISOString(),
          },
        },
        tx
      );

      const nextUser = await tx.user.findUnique({ where: { user_id: user.user_id } });
      return { updatedUser: nextUser!, admin: adminRecord };
    });

    return {
      user: updatedUser,
      admin: {
        role_description: admin.role_description,
        status: admin.status as "ACTIVE" | "INACTIVE",
      },
    };
  }

  /**
   * Get security logs
   */
  async getSecurityLogs(params: GetSecurityLogsQuery): Promise<{
    logs: Awaited<ReturnType<typeof securityAuditLogReader.findAll>>["logs"];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { logs, total } = await securityAuditLogReader.findAll(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      logs,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  async exportSecurityLogs(params: Omit<GetSecurityLogsQuery, "page" | "pageSize">) {
    return securityAuditLogReader.findAllForExport(params);
  }

  /**
   * Get pending admin invitations
   */
  async getPendingInvitations(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    roleDescription?: AdminRoleKey;
  }): Promise<{
    invitations: Array<{
      id: string;
      email: string;
      role_description: string;
      token: string;
      expires_at: Date;
      created_at: Date;
      invited_by: { first_name: string; last_name: string; email: string };
    }>;
    pagination: {
      currentPage: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    return this.repository.getPendingInvitations(params);
  }

  /**
   * Resend admin invitation email (by invitation ID)
   */
  async resendInvitation(
    req: Request,
    invitationId: string,
    invitedBy: string
  ): Promise<{ messageId?: string; emailSent: boolean; emailError?: string }> {
    const invitation = await this.repository.getAdminInvitationById(invitationId);

    if (!invitation) {
      throw new AppError(404, "NOT_FOUND", "Invitation not found");
    }

    if (invitation.accepted) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has already been accepted");
    }

    if (new Date() > invitation.expires_at) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has expired");
    }

    // Only send email if invitation has a real email (not placeholder)
    if (!invitation.email || invitation.email.startsWith("invitation-")) {
      throw new AppError(400, "VALIDATION_ERROR", "Cannot resend link-based invitation via email");
    }

    const inviter = await this.repository.getUserById(invitedBy);
    if (!inviter) {
      throw new AppError(404, "NOT_FOUND", "Inviter not found");
    }

    const invitationRole = await this.requireAdminRoleConfig(invitation.role_description);

    // Generate invitation URL
    const adminPortalUrl = process.env.ADMIN_URL || "http://localhost:3003";
    const inviteUrl = `${adminPortalUrl}/callback?invitation=${invitation.token}&role=${invitation.role_description}`;

    let messageId: string | undefined;
    let emailSent = false;
    let emailError: string | undefined;

    try {
      const inviterName = `${inviter.first_name} ${inviter.last_name}`;
      const template = adminInvitationTemplate(
        inviteUrl,
        {
          key: invitationRole.key as AdminRoleKey,
          name: invitationRole.name,
          description: invitationRole.description,
        },
        inviterName
      );

      const result = await sendEmail({
        to: invitation.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      messageId = result.messageId;
      emailSent = true;

      logger.info(
        {
          email: invitation.email,
          roleDescription: invitation.role_description,
          invitedBy,
          messageId,
        },
        "Admin invitation resent via email"
      );

      await writeSecurityAuditLog({
        eventType: "ADMIN_INVITATION_RESENT",
        context: auditContextFromAdminRequest(req),
        subjectUserId: null,
        targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_INVITATION,
        targetId: invitation.id,
        metadata: {
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role_description,
          expiresAt: invitation.expires_at.toISOString(),
          emailSent: true,
        },
      });
    } catch (error) {
      emailSent = false;
      emailError = error instanceof Error ? error.message : String(error);

      logger.warn(
        {
          email: invitation.email,
          roleDescription: invitation.role_description,
          invitedBy,
          error: emailError,
        },
        "Failed to resend admin invitation email"
      );
    }

    return { messageId, emailSent, ...(emailError && { emailError }) };
  }

  /**
   * Revoke/delete a pending admin invitation
   */
  async revokeInvitation(req: Request, invitationId: string, revokedBy: string): Promise<void> {
    const invitation = await this.repository.getAdminInvitationById(invitationId);

    if (!invitation) {
      throw new AppError(404, "NOT_FOUND", "Invitation not found");
    }

    if (invitation.accepted) {
      throw new AppError(400, "VALIDATION_ERROR", "Cannot revoke an accepted invitation");
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminInvitation.delete({ where: { id: invitationId } });
      await writeSecurityAuditLog(
        {
          eventType: "ADMIN_INVITATION_REVOKED",
          context: auditContextFromAdminRequest(req),
          subjectUserId: null,
          targetType: SECURITY_AUDIT_TARGET_TYPE.ADMIN_INVITATION,
          targetId: invitationId,
          metadata: {
            invitationId,
            email: invitation.email,
            role: invitation.role_description,
            expiresAt: invitation.expires_at.toISOString(),
          },
        },
        tx
      );
    });

    logger.info(
      {
        invitationId,
        email: invitation.email,
        roleDescription: invitation.role_description,
        revokedBy,
      },
      "Admin invitation revoked"
    );
  }

  /**
   * List onboarding logs with pagination and filters
   */
  async listOnboardingLogs(params: GetOnboardingLogsQuery): Promise<{
    logs: OnboardingAuditLogDto[];
    total: number;
  }> {
    return onboardingAuditLogReader.findAll(params);
  }

  async getOnboardingLogById(logId: string): Promise<OnboardingAuditLogDto | null> {
    return onboardingAuditLogReader.findById(logId);
  }

  async exportOnboardingLogs(
    params: Omit<GetOnboardingLogsQuery, "page" | "pageSize">
  ): Promise<OnboardingAuditLogDto[]> {
    return onboardingAuditLogReader.findAllForExport(params);
  }

  /**
   * Reset onboarding for a user (admin only - temporary feature for testing)
   */
  async resetOnboarding(
    req: Request,
    userId: string,
    data: ResetOnboardingInput,
    adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const updateData: { investorOnboarded?: boolean; issuerOnboarded?: boolean } = {};

    if (data.portal === "investor") {
      if (user.investor_account.length === 0) {
        throw new AppError(400, "BAD_REQUEST", "User has not completed investor onboarding");
      }
      updateData.investorOnboarded = false;
    } else if (data.portal === "issuer") {
      if (user.issuer_account.length === 0) {
        throw new AppError(400, "BAD_REQUEST", "User has not completed issuer onboarding");
      }
      updateData.issuerOnboarded = false;
    }

    const latestOrg =
      data.portal === "investor"
        ? (
          await prisma.investorOrganization.findMany({
            where: { owner_user_id: userId },
            orderBy: { updated_at: "desc" },
            take: 1,
          })
        )[0]
        : (
          await prisma.issuerOrganization.findMany({
            where: { owner_user_id: userId },
            orderBy: { updated_at: "desc" },
            take: 1,
          })
        )[0];

    const previousMarker =
      data.portal === "investor" ? user.investor_account : user.issuer_account;
    const context = auditContextFromAdminRequest(req);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const next = await this.repository.updateUserOnboarding(userId, updateData, undefined, tx);
      await writeOnboardingAuditLog(
        {
          eventType: "ONBOARDING_RESET",
          context,
          subjectUserId: userId,
          organizationId: latestOrg?.id ?? null,
          organizationKind: data.portal === "investor" ? "INVESTOR" : "ISSUER",
          organizationType: latestOrg?.type ?? null,
          targetType: ONBOARDING_AUDIT_TARGET_TYPE.USER,
          targetId: userId,
          metadata: {
            statusScope: "USER_ACCOUNT_MARKER",
            organizationStateReset: false,
            portal: data.portal,
            previousAccountMarker: previousMarker,
            newAccountMarker: data.portal === "investor" ? next.investor_account : next.issuer_account,
          },
        },
        tx
      );
      return next;
    });

    logger.info(
      {
        userId,
        portal: data.portal,
        resetBy: adminUserId,
      },
      "Onboarding reset by admin"
    );

    return updatedUser;
  }

  /**
   * Get all organizations (investor + issuer) with pagination and filters
   */
  async getOrganizations(params: {
    page: number;
    pageSize: number;
    search?: string;
    portal?: "investor" | "issuer";
    type?: "PERSONAL" | "COMPANY";
    onboardingStatus?:
    | "PENDING"
    | "IN_PROGRESS"
    | "PENDING_APPROVAL"
    | "PENDING_AMENDMENT"
    | "PENDING_AML"
    | "PENDING_SSM_REVIEW"
    | "PENDING_FINAL_APPROVAL"
    | "COMPLETED"
    | "REJECTED";
  }): Promise<{
    organizations: {
      id: string;
      displayReference: string | null;
      portal: "investor" | "issuer";
      type: "PERSONAL" | "COMPANY";
      name: string | null;
      registrationNumber: string | null;
      onboardingStatus:
      | "PENDING"
      | "IN_PROGRESS"
      | "PENDING_APPROVAL"
      | "PENDING_AMENDMENT"
      | "PENDING_AML"
      | "PENDING_SSM_REVIEW"
      | "PENDING_FINAL_APPROVAL"
      | "COMPLETED"
      | "REJECTED";
      onboardedAt: string | null;
      owner: {
        userId: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      memberCount: number;
      isSophisticatedInvestor: boolean;
      depositReceived: boolean;
      walletBalance: number | null;
      investedAmount: number | null;
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const result = await this.repository.getOrganizations(params);

    return {
      organizations: result.organizations.map((org) => ({
        ...org,
        onboardedAt: org.onboardedAt?.toISOString() ?? null,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      })),
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: result.total,
        totalPages: Math.ceil(result.total / params.pageSize),
      },
    };
  }

  /**
   * Get organization detail by portal and ID
   */
  async getOrganizationDetail(
    portal: "investor" | "issuer",
    id: string
  ): Promise<{
    id: string;
    displayReference: string | null;
    portal: "investor" | "issuer";
    type: "PERSONAL" | "COMPANY";
    name: string | null;
    registrationNumber: string | null;
    onboardingStatus: string;
    onboardedAt: string | null;
    createdAt: string;
    updatedAt: string;
    owner: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    nationality: string | null;
    country: string | null;
    idIssuingCountry: string | null;
    gender: string | null;
    address: string | null;
    dateOfBirth: string | null;
    phoneNumber: string | null;
    documentType: string | null;
    documentNumber: string | null;
    kycId: string | null;
    bankAccountDetails: Record<string, unknown> | null;
    wealthDeclaration: Record<string, unknown> | null;
    complianceDeclaration: Record<string, unknown> | null;
    documentInfo: Record<string, unknown> | null;
    livenessCheckInfo: Record<string, unknown> | null;
    kycResponse: Record<string, unknown> | null;
    members: {
      id: string;
      userId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      role: string;
      createdAt: string;
    }[];
    isSophisticatedInvestor: boolean;
    sophisticatedInvestorReason: string | null;
    walletBalance: number | null;
    investedAmount: number | null;
    approvedFacilityAmount: number | null;
    activeNotesAmount: number | null;
    regtankPortalUrl: string | null;
    regtankRequestId: string | null;
    codRequestId: string | null;
    tncAccepted: boolean;
    onboardingFeePaid: boolean;
    ssmApproved: boolean;
    onboardingApproved: boolean;
    amlApproved: boolean;
    regtankSessionStatus: string | null;
    corporateOnboardingData?: {
      basicInfo?: {
        tinNumber?: string;
        industry?: string;
        entityType?: string;
        businessName?: string;
        numberOfEmployees?: number;
        ssmRegisterNumber?: string;
        annualRevenue?: string;
        website?: string;
        phoneNumber?: string;
      };
      addresses?: {
        business?: {
          line1?: string | null;
          line2?: string | null;
          city?: string | null;
          postalCode?: string | null;
          state?: string | null;
          country?: string | null;
        };
        registered?: {
          line1?: string | null;
          line2?: string | null;
          city?: string | null;
          postalCode?: string | null;
          state?: string | null;
          country?: string | null;
        };
      };
      personInCharge?: {
        name?: string | null;
        position?: string | null;
        email?: string | null;
        contactNumber?: string | null;
      };
    };
    corporateEntities?: Record<string, unknown> | null;
    latestOrganizationCtosCompanyJson?: Record<string, unknown> | null;
    ctosPartySupplements?: Array<{ partyKey: string; onboardingJson?: unknown }> | null;
    latestOrganizationCtosSubjectReports?: Array<{
      id: string;
      subject_ref: string | null;
      fetched_at: string;
      has_report_html: boolean;
    }>;
    corporateRequiredDocuments?: Record<string, unknown>[] | null;
    directorAmlStatus?: Record<string, unknown> | null;
    directorKycStatus?: Record<string, unknown> | null;
    businessAmlStatus?: Record<string, unknown> | null;
    people?: import("@cashsouk/types").ApplicationPersonRow[];
  } | null> {
    const org = await this.repository.getOrganizationById(portal, id);

    if (!org) {
      return null;
    }

    let codRequestId: string | null = null;
    if (org.type === "COMPANY") {
      const onboarding = await this.regTankRepository.findByOrganizationId(org.id, portal);
      codRequestId = onboarding?.request_id ?? null;
    }

    let latestOrganizationCtosCompanyJson: Record<string, unknown> | null | undefined = undefined;
    let ctosPartySupplements: Array<{ partyKey: string; onboardingJson?: unknown }> | null | undefined =
      undefined;
    let investorLatestCtosCompanyJson: Record<string, unknown> | null | undefined = undefined;
    let investorCtosPartySupplements: Array<{ partyKey: string; onboardingJson?: unknown }> | null | undefined =
      undefined;
    let latestOrganizationCtosSubjectReports:
      | Array<{
          id: string;
          subject_ref: string | null;
          fetched_at: string;
          has_report_html: boolean;
        }>
      | undefined = undefined;
    if (portal === "issuer") {
      const orgService = new OrganizationService();
      const extras = await orgService.getIssuerPartyListExtras(org.id);
      latestOrganizationCtosCompanyJson =
        (extras.latestOrganizationCtosCompanyJson as Record<string, unknown> | null) ?? null;
      ctosPartySupplements = extras.ctosPartySupplements.map((row) => ({
        partyKey: row.partyKey,
        onboardingJson: row.onboardingJson,
      }));
      if (org.type === "COMPANY") {
        latestOrganizationCtosSubjectReports = extras.latestOrganizationCtosSubjectReports;
      }
    }
    if (portal === "investor" && org.type === "COMPANY") {
      const orgService = new OrganizationService();
      const extras = await orgService.getInvestorPartyListExtras(org.id);
      investorLatestCtosCompanyJson =
        (extras.latestOrganizationCtosCompanyJson as Record<string, unknown> | null) ?? null;
      investorCtosPartySupplements = extras.ctosPartySupplements.map((row) => ({
        partyKey: row.partyKey,
        onboardingJson: row.onboardingJson,
      }));
      latestOrganizationCtosSubjectReports = extras.latestOrganizationCtosSubjectReports;
    }

    const investedAmount =
      portal === "investor"
        ? (
            await prisma.noteInvestment.aggregate({
              where: {
                investor_organization_id: id,
                status: { in: ["COMMITTED", "CONFIRMED"] },
              },
              _sum: { amount: true },
            })
          )._sum.amount?.toNumber() ?? 0
        : null;

    let approvedFacilityAmount: number | null = null;
    let activeNotesAmount: number | null = null;
    if (portal === "issuer") {
      const [approvedContracts, activeNotesSum] = await Promise.all([
        prisma.contract.findMany({
          where: { issuer_organization_id: id, status: "APPROVED" },
          select: { status: true, contract_details: true },
        }),
        prisma.note.aggregate({
          where: { issuer_organization_id: id, status: "ACTIVE" },
          _sum: { funded_amount: true },
        }),
      ]);
      approvedFacilityAmount = sumApprovedFacilityAmount(approvedContracts);
      activeNotesAmount = activeNotesSum._sum.funded_amount?.toNumber() ?? 0;
    }

    return {
      id: org.id,
      displayReference: org.display_reference ?? null,
      portal,
      type: org.type as "PERSONAL" | "COMPANY",
      name: org.name,
      registrationNumber: org.registration_number,
      onboardingStatus: org.onboarding_status,
      onboardedAt: org.onboarded_at?.toISOString() ?? null,
      createdAt: org.created_at.toISOString(),
      updatedAt: org.updated_at.toISOString(),
      owner: {
        userId: org.owner.user_id,
        email: org.owner.email,
        firstName: org.owner.first_name,
        lastName: org.owner.last_name,
      },
      firstName: org.first_name,
      lastName: org.last_name,
      middleName: org.middle_name,
      nationality: org.nationality,
      country: org.country,
      idIssuingCountry: org.id_issuing_country,
      gender: org.gender,
      address: org.address,
      dateOfBirth: org.date_of_birth?.toISOString() ?? null,
      phoneNumber: org.phone_number,
      documentType: org.document_type,
      documentNumber: org.document_number,
      kycId: org.kyc_id,
      bankAccountDetails: org.bank_account_details as Record<string, unknown> | null,
      wealthDeclaration: org.wealth_declaration as Record<string, unknown> | null,
      complianceDeclaration: org.compliance_declaration as Record<string, unknown> | null,
      documentInfo: org.document_info as Record<string, unknown> | null,
      livenessCheckInfo: org.liveness_check_info as Record<string, unknown> | null,
      kycResponse: org.kyc_response as Record<string, unknown> | null,
      corporateOnboardingData: (() => {
        if (!org.corporate_onboarding_data || org.type !== "COMPANY") return undefined;
        const data = org.corporate_onboarding_data as {
          basicInfo?: {
            tin?: string;
            tinNumber?: string;
            industry?: string;
            entityType?: string;
            businessName?: string;
            numberOfEmployees?: number | string;
            ssmRegistrationNumber?: string;
            ssmRegisterNumber?: string;
            annualRevenue?: string;
            website?: string;
            phoneNumber?: string;
          };
          addresses?: {
            business?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              postalCode?: string | null;
              state?: string | null;
              country?: string | null;
            };
            registered?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              postalCode?: string | null;
              state?: string | null;
              country?: string | null;
            };
            businessAddress?: string;
            registeredAddress?: string;
          };
          personInCharge?: {
            name?: string | null;
            position?: string | null;
            email?: string | null;
            contactNumber?: string | null;
          };
        };

        return {
          basicInfo: data.basicInfo
            ? {
              tinNumber: data.basicInfo.tinNumber || data.basicInfo.tin || undefined,
              industry: data.basicInfo.industry,
              entityType: data.basicInfo.entityType,
              businessName: data.basicInfo.businessName,
              numberOfEmployees:
                typeof data.basicInfo.numberOfEmployees === "string"
                  ? parseInt(data.basicInfo.numberOfEmployees, 10) || undefined
                  : data.basicInfo.numberOfEmployees,
              ssmRegisterNumber:
                data.basicInfo.ssmRegisterNumber ||
                data.basicInfo.ssmRegistrationNumber ||
                undefined,
              annualRevenue: data.basicInfo.annualRevenue || undefined,
              website: data.basicInfo.website || undefined,
              phoneNumber: data.basicInfo.phoneNumber || undefined,
            }
            : undefined,
          addresses: data.addresses
            ? {
              business: data.addresses.business || undefined,
              registered: data.addresses.registered || undefined,
            }
            : undefined,
          personInCharge: data.personInCharge
            ? {
              name: data.personInCharge.name || undefined,
              position: data.personInCharge.position || undefined,
              email: data.personInCharge.email || undefined,
              contactNumber: data.personInCharge.contactNumber || undefined,
            }
            : undefined,
        };
      })(),
      corporateEntities: org.type === "COMPANY" ? (org.corporate_entities as Record<string, unknown> | null) : undefined,
      latestOrganizationCtosCompanyJson:
        org.type === "COMPANY" && portal === "issuer"
          ? latestOrganizationCtosCompanyJson ?? null
          : undefined,
      ctosPartySupplements:
        org.type === "COMPANY" && portal === "issuer" ? ctosPartySupplements ?? [] : undefined,
      latestOrganizationCtosSubjectReports:
        org.type === "COMPANY" ? latestOrganizationCtosSubjectReports ?? [] : undefined,
      corporateRequiredDocuments: org.type === "COMPANY" ? (org.corporate_required_documents as Record<string, unknown>[] | null) : undefined,
      directorAmlStatus: org.type === "COMPANY" ? (org.director_aml_status as Record<string, unknown> | null) : undefined,
      directorKycStatus: org.type === "COMPANY" ? (org.director_kyc_status as Record<string, unknown> | null) : undefined,
      businessAmlStatus: org.type === "COMPANY" ? (org.business_aml_status as Record<string, unknown> | null) : undefined,
      ...(org.type === "COMPANY"
        ? (() => {
            const partyBuild = buildDirectorShareholderPeopleList({
              ctos:
                portal === "issuer"
                  ? (latestOrganizationCtosCompanyJson ?? null)
                  : (investorLatestCtosCompanyJson ?? null),
              issuerDirectorKycStatus: org.director_kyc_status ?? null,
              issuerDirectorAmlStatus: org.director_aml_status ?? null,
              ctosPartySupplements:
                portal === "issuer"
                  ? (ctosPartySupplements ?? null)
                  : (investorCtosPartySupplements ?? null),
              corporateEntities: org.corporate_entities ?? null,
              parentCorporateRequestId: codRequestId,
            });
            return {
              people: partyBuild.people,
              directorShareholderListSource: partyBuild.listSource,
              ctosDirectorShareholderWarning: partyBuild.ctosDirectorShareholderWarning,
            };
          })()
        : {}),
      members: org.members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        firstName: m.user.first_name,
        lastName: m.user.last_name,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
        createdAt: m.created_at.toISOString(),
      })),
      // Sophisticated investor status (only for investor portal, false for issuer)
      isSophisticatedInvestor:
        portal === "investor" ? (org.is_sophisticated_investor ?? false) : false,
      sophisticatedInvestorReason:
        portal === "investor" ? (org.sophisticated_investor_reason ?? null) : null,
      walletBalance:
        portal === "investor"
          ? (org.investor_balance?.available_amount?.toNumber() ?? 0)
          : null,
      investedAmount,
      approvedFacilityAmount,
      activeNotesAmount,
      // Build RegTank portal URL from latest onboarding record
      regtankRequestId: org.regtank_onboarding?.[0]?.request_id ?? null,
      codRequestId,
      tncAccepted: Boolean(org.tnc_accepted),
      onboardingFeePaid: portal === "issuer" ? Boolean(org.onboarding_fee_paid_at) : false,
      ssmApproved:
        portal === "investor" ? Boolean(org.ssm_approved) : Boolean(org.ssm_checked),
      onboardingApproved: Boolean(org.onboarding_approved),
      amlApproved: Boolean(org.aml_approved),
      regtankSessionStatus: org.regtank_onboarding?.[0]?.status ?? null,
      regtankPortalUrl: (() => {
        const requestId = org.regtank_onboarding?.[0]?.request_id;
        if (!requestId) return null;
        const baseUrl = getRegTankConfig().adminPortalUrl;
        if (org.type === "COMPANY" && requestId.startsWith("COD")) {
          return `${baseUrl}/app/onboardingCorporate/${requestId}?archived=false`;
        }
        return `${baseUrl}/app/liveness/${requestId}?archived=false`;
      })(),
    };
  }

  async listOrganizationLinkedRecords(
    portal: "issuer" | "investor",
    organizationId: string,
    query: GetOrganizationLinkedRecordsQuery
  ) {
    return listOrganizationLinkedRecords(portal, organizationId, query);
  }

  async updateOrganizationProfile(
    req: Request,
    portal: "issuer" | "investor",
    organizationId: string,
    input: UpdateAdminOrganizationProfileBody,
    _adminUserId: string
  ) {
    return updateAdminOrganizationProfile({
      portal,
      organizationId,
      input,
      context: auditContextFromAdminRequest(req),
    });
  }

  async notifyIssuerDirectorShareholderActionRequired(
    issuerOrganizationId: string,
    input: { partyKey: string }
  ): Promise<{ sent: true }> {
    const org = await prisma.issuerOrganization.findUnique({
      where: { id: issuerOrganizationId },
      select: { owner_user_id: true, type: true },
    });
    if (!org || org.type !== "COMPANY") {
      throw new AppError(404, "NOT_FOUND", "Issuer company organization not found");
    }
    if (!org.owner_user_id) {
      throw new AppError(400, "VALIDATION_ERROR", "Organization has no owner");
    }

    const orgSvc = new OrganizationService();
    const extras = await orgSvc.getIssuerPartyListExtras(issuerOrganizationId);
    const fullOrg = await prisma.issuerOrganization.findUnique({
      where: { id: issuerOrganizationId },
      select: {
        corporate_entities: true,
        director_kyc_status: true,
        director_aml_status: true,
        onboarding_status: true,
      },
    });
    if (!fullOrg) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const people = buildAdminPeopleList({
      ctos: extras.latestOrganizationCtosCompanyJson ?? null,
      issuerDirectorKycStatus: fullOrg.director_kyc_status ?? null,
      issuerDirectorAmlStatus: fullOrg.director_aml_status ?? null,
      ctosPartySupplements: extras.ctosPartySupplements.map((s) => ({
        party_key: s.partyKey,
        onboarding_json: s.onboardingJson,
      })),
      corporateEntities: fullOrg.corporate_entities ?? null,
    });
    const visible = filterVisiblePeopleRows(people);
    const want = normalizeDirectorShareholderIdKey(input.partyKey);
    if (!want) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid party key");
    }
    const match = visible.find((p) => normalizeDirectorShareholderIdKey(p.matchKey) === want);
    if (!match) {
      throw new AppError(404, "NOT_FOUND", "Party not found among visible directors/shareholders");
    }

    const emailActionable = canManageDirectorShareholder(match);
    if (!emailActionable) {
      throw new AppError(400, "VALIDATION_ERROR", "Not eligible for notify");
    }

    await notifyIssuerDirectorShareholderActionRequired({
      issuerOrganizationId,
      ownerUserId: org.owner_user_id,
      partyKeyRaw: input.partyKey,
      personName: match.name,
    });
    return { sent: true };
  }

  /**
   * Refresh corporate entities from RegTank for a company organization.
   * Fetches latest COD details and updates corporate_entities in the database.
   */
  async refreshOrganizationCorporateEntities(
    _req: Request,
    organizationId: string,
    portal: PortalType
  ): Promise<{ success: boolean; message: string }> {
    const org = await this.repository.getOrganizationById(portal, organizationId);
    if (!org || org.type !== "COMPANY") {
      throw new AppError(404, "NOT_FOUND", "Organization not found or not a company");
    }

    const onboarding = await this.regTankRepository.findByOrganizationId(organizationId, portal);
    if (!onboarding?.request_id) {
      throw new AppError(404, "NOT_FOUND", "No RegTank onboarding found for this organization");
    }

    const codDetails = await this.regTankApiClient.getCorporateOnboardingDetails(onboarding.request_id);
    const corporateEntities = extractCorporateEntities(codDetails);

    await prisma.$transaction(async (tx) => {
      await lockOrganizationRow(tx, portal, organizationId);
      const locked =
        portal === "investor"
          ? await tx.investorOrganization.findUnique({
              where: { id: organizationId },
              select: { corporate_entities: true },
            })
          : await tx.issuerOrganization.findUnique({
              where: { id: organizationId },
              select: { corporate_entities: true },
            });
      if (!locked) return;

      if (portal === "investor") {
        await tx.investorOrganization.update({
          where: { id: organizationId },
          data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
        });
      } else {
        await tx.issuerOrganization.update({
          where: { id: organizationId },
          data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
        });
      }

    });

    logger.info(
      { organizationId, portal, codRequestId: onboarding.request_id },
      "Corporate entities refreshed successfully"
    );

    return { success: true, message: "Corporate entities refreshed successfully" };
  }

  /**
   * Update sophisticated investor status for an investor organization
   * Only applicable for investor portal organizations
   */
  async updateSophisticatedStatus(
    req: Request,
    organizationId: string,
    isSophisticatedInvestor: boolean,
    reason: string,
    adminUserId?: string
  ): Promise<{ success: boolean }> {
    const org = await prisma.investorOrganization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        owner_user_id: true,
        is_sophisticated_investor: true,
        sophisticated_investor_reason: true,
      },
    });

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Investor organization not found");
    }

    if (
      org.is_sophisticated_investor === isSophisticatedInvestor &&
      (org.sophisticated_investor_reason ?? "") === reason
    ) {
      return { success: true };
    }

    const action = isSophisticatedInvestor ? "GRANTED" : "REVOKED";
    const context = auditContextFromAdminRequest(req);

    await prisma.$transaction(async (tx) => {
      await tx.investorOrganization.update({
        where: { id: organizationId },
        data: {
          is_sophisticated_investor: isSophisticatedInvestor,
          sophisticated_investor_reason: reason,
        },
      });

      await writeOnboardingAuditLog(
        {
          eventType: "INVESTOR_SOPHISTICATED_STATUS_UPDATED",
          context,
          subjectUserId: org.owner_user_id,
          organizationId,
          organizationKind: "INVESTOR",
          organizationType: null,
          targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
          targetId: organizationId,
          metadata: {
            previousValue: org.is_sophisticated_investor,
            newValue: isSophisticatedInvestor,
            previousReason: org.sophisticated_investor_reason,
            newReason: reason,
            action,
          },
        },
        tx
      );
    });

    logger.info(
      {
        organizationId,
        previousStatus: org.is_sophisticated_investor,
        newStatus: isSophisticatedInvestor,
        reason,
        updatedBy: adminUserId,
      },
      "Updated sophisticated investor status"
    );

    return { success: true };
  }

  /**
   * List onboarding applications for admin approval queue
   * Combines data from regtank_onboarding with investor/issuer organizations
   * Maps RegTank statuses to admin-friendly approval statuses
   *
   * When status filter is applied, we fetch all records and filter/paginate in memory
   * because queue status is computed in mapTo (org onboarding_status + RegTank terminal states).
   */
  async listOnboardingApplications(params: GetOnboardingApplicationsQuery): Promise<{
    applications: OnboardingApplicationResponse[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const pendingAllStatuses: OnboardingApprovalStatus[] = [
      "PENDING_AMENDMENT",
      "PENDING_SSM_REVIEW",
      "PENDING_APPROVAL",
      "PENDING_AML",
      "PENDING_FINAL_APPROVAL",
    ];

    // When status filter is applied, fetch all records for in-memory filtering/pagination
    const needsInMemoryFiltering = !!params.status;

    if (needsInMemoryFiltering) {
      // Fetch all records (up to 1000) for filtering
      const { applications } = await this.regTankRepository.listOnboardingApplications({
        page: 1,
        pageSize: 1000,
        search: params.search,
        portal: params.portal as "investor" | "issuer" | undefined,
        type: params.type as OrganizationType | undefined,
      });

      // Map applications to response format with derived approval status
      const mappedApplications = applications.map((app) =>
        this.mapToOnboardingApplicationResponse(app)
      );

      // Filter by status
      let filteredApplications: OnboardingApplicationResponse[];
      if (params.status === "PENDING_ALL") {
        filteredApplications = mappedApplications.filter((app) =>
          pendingAllStatuses.includes(app.status)
        );
      } else {
        filteredApplications = mappedApplications.filter((app) => app.status === params.status);
      }

      // Apply pagination in memory
      const totalCount = filteredApplications.length;
      const startIndex = (params.page - 1) * params.pageSize;
      const paginatedApplications = filteredApplications.slice(
        startIndex,
        startIndex + params.pageSize
      );

      return {
        applications: paginatedApplications,
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / params.pageSize),
        },
      };
    }

    // No status filter - use database pagination directly
    const { applications, totalCount } = await this.regTankRepository.listOnboardingApplications({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      portal: params.portal as "investor" | "issuer" | undefined,
      type: params.type as OrganizationType | undefined,
    });

    const mappedApplications = applications.map((app) =>
      this.mapToOnboardingApplicationResponse(app)
    );

    return {
      applications: mappedApplications,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / params.pageSize),
      },
    };
  }

  /**
   * Get a single onboarding application by ID
   */
  async getOnboardingApplicationById(id: string): Promise<OnboardingApplicationResponse | null> {
    const application = await this.regTankRepository.getOnboardingApplicationById(id);
    if (!application) {
      return null;
    }
    const isInvestor = application.portal_type === "investor";
    const orgId = isInvestor ? application.investor_organization_id : application.issuer_organization_id;
    if (orgId) {
      await advanceOnboardingStatusFromFlags({
        organizationId: orgId,
        portalType: isInvestor ? "investor" : "issuer",
        reason: "ADMIN_ONBOARDING_APPLICATION_FETCH",
      });
    }
    const refreshed = await this.regTankRepository.getOnboardingApplicationById(id);
    if (!refreshed) {
      return null;
    }
    const existingResponse = this.mapToOnboardingApplicationResponse(refreshed);
    const organizationForPeople =
      refreshed.portal_type === "investor"
        ? refreshed.investor_organization
        : refreshed.issuer_organization;
    const partyBuild = buildDirectorShareholderPeopleList({
      ctos: existingResponse.latestOrganizationCtosCompanyJson,
      issuerDirectorKycStatus: organizationForPeople?.director_kyc_status ?? null,
      issuerDirectorAmlStatus: organizationForPeople?.director_aml_status ?? null,
      ctosPartySupplements: organizationForPeople?.ctos_party_supplements ?? null,
      corporateEntities: existingResponse.corporateEntities ?? null,
      parentCorporateRequestId: refreshed.request_id,
    });

    return {
      ...existingResponse,
      people: partyBuild.people,
      directorShareholderListSource: partyBuild.listSource,
      ctosDirectorShareholderWarning: partyBuild.ctosDirectorShareholderWarning,
    };
  }

  /**
   * Get count of onboarding applications requiring admin action
   * Includes: PENDING_SSM_REVIEW, PENDING_AMENDMENT, PENDING_APPROVAL, PENDING_AML, PENDING_FINAL_APPROVAL
   * Excludes: PENDING_ONBOARDING (user action, not admin)
   */
  async getPendingApprovalCount(): Promise<{ count: number }> {
    // Get all applications (without pagination) to derive statuses
    const { applications } = await this.regTankRepository.listOnboardingApplications({
      page: 1,
      pageSize: 1000, // Get all records for counting
    });

    // Map and filter for admin-actionable statuses
    const pendingStatuses: OnboardingApprovalStatus[] = [
      "PENDING_SSM_REVIEW",
      "PENDING_AMENDMENT",
      "PENDING_APPROVAL",
      "PENDING_AML",
      "PENDING_FINAL_APPROVAL",
    ];

    const count = applications
      .map((app) => this.mapToOnboardingApplicationResponse(app))
      .filter((app) => pendingStatuses.includes(app.status)).length;

    return { count };
  }

  /**
   * Admin queue / badge status: org onboarding_status is primary; RegTank row only for terminal lifecycle.
   */
  private queueStatusFromOnboardingRecord(
    regtankStatus: string,
    orgOnboardingStatus: string
  ): OnboardingApprovalStatus {
    if (regtankStatus === "REJECTED") {
      return "REJECTED";
    }
    if (regtankStatus === "EXPIRED") {
      return "EXPIRED";
    }
    if (regtankStatus === "CANCELLED") {
      return "CANCELLED";
    }
    switch (orgOnboardingStatus) {
      case OnboardingStatus.PENDING:
      case OnboardingStatus.IN_PROGRESS:
        return "PENDING_ONBOARDING";
      case OnboardingStatus.PENDING_SSM_REVIEW:
        return "PENDING_SSM_REVIEW";
      case OnboardingStatus.PENDING_AMENDMENT:
        return "PENDING_AMENDMENT";
      case OnboardingStatus.PENDING_APPROVAL:
        return "PENDING_APPROVAL";
      case OnboardingStatus.PENDING_AML:
        return "PENDING_AML";
      case OnboardingStatus.PENDING_FINAL_APPROVAL:
        return "PENDING_FINAL_APPROVAL";
      case OnboardingStatus.COMPLETED:
        return "COMPLETED";
      case OnboardingStatus.REJECTED:
        return "REJECTED";
      default:
        return "PENDING_ONBOARDING";
    }
  }

  /**
   * Map a RegTank onboarding record to the admin-friendly response format.
   * onboarding_status on the organization drives the admin flow step; status mirrors the queue label.
   */
  private mapToOnboardingApplicationResponse(
    record: OnboardingApplicationRecord
  ): OnboardingApplicationResponse {
    const isInvestor = record.portal_type === "investor";
    const org = isInvestor ? record.investor_organization : record.issuer_organization;
    const orgOnboardingStatus = org?.onboarding_status || OnboardingStatus.PENDING;

    const isInvestorOrg = record.portal_type === "investor";
    const investorOrg = record.investor_organization;
    const issuerOrg = record.issuer_organization;

    const ssmApproved = isInvestorOrg
      ? (investorOrg?.ssm_approved ?? false)
      : (issuerOrg?.ssm_checked ?? false);

    const status = this.queueStatusFromOnboardingRecord(record.status, orgOnboardingStatus);

    // Build user name
    const userName = `${record.user.first_name} ${record.user.last_name}`.trim();

    // Build RegTank portal URL for direct linking to the onboarding record
    const regtankConfig = getRegTankConfig();
    // For corporate onboarding, use onboardingCorporate endpoint; for individual, use liveness endpoint
    const regtankPortalUrl = record.request_id
      ? record.onboarding_type === "CORPORATE"
        ? `${regtankConfig.adminPortalUrl}/app/onboardingCorporate/${record.request_id}?archived=false`
        : `${regtankConfig.adminPortalUrl}/app/liveness/${record.request_id}?archived=false`
      : null;

    // Build KYC portal URL for individual AML review (uses kyc_id from organization)
    const kycId = isInvestor
      ? record.investor_organization?.kyc_id
      : record.issuer_organization?.kyc_id;
    const kycPortalUrl = kycId
      ? `${regtankConfig.adminPortalUrl}/app/screen-kyc/result/${kycId}`
      : null;

    // Build KYB portal URL for corporate AML review (extract kybId from COD/KYB webhook payloads)
    let kybId: string | null = null;
    if (record.onboarding_type === "CORPORATE" && record.webhook_payloads) {
      // Find kybId from webhook payloads (check both COD webhooks with kybRequestDto and KYB webhooks)
      for (const payload of record.webhook_payloads) {
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const payloadObj = payload as Record<string, unknown>;
          // Check if this is a COD webhook with kybId directly
          if (payloadObj.kybId && typeof payloadObj.kybId === "string") {
            kybId = payloadObj.kybId;
            break;
          }
          // Check if this is a COD webhook with kybRequestDto containing kybId
          const kybRequestDto = payloadObj.kybRequestDto;
          if (
            kybRequestDto &&
            typeof kybRequestDto === "object" &&
            !Array.isArray(kybRequestDto)
          ) {
            const kybDto = kybRequestDto as Record<string, unknown>;
            if (kybDto.kybId && typeof kybDto.kybId === "string") {
              kybId = kybDto.kybId;
              break;
            }
          }
          // Check if this is a KYB webhook with requestId as kybId
          if (payloadObj.requestId && typeof payloadObj.requestId === "string") {
            // KYB webhook has requestId that matches the kybId pattern (e.g., KYB00006)
            const requestId = payloadObj.requestId as string;
            if (requestId.startsWith("KYB")) {
              kybId = requestId;
              break;
            }
          }
        }
      }
    }

    const kybPortalUrl = kybId
      ? `${regtankConfig.adminPortalUrl}/app/screen-kyb/result/${kybId}`
      : null;

    // For investors, use investor_organization fields; for issuers, use issuer_organization fields
    const onboardingApproved = isInvestorOrg
      ? (investorOrg?.onboarding_approved ?? false)
      : (issuerOrg?.onboarding_approved ?? false);
    const amlApproved = isInvestorOrg
      ? (investorOrg?.aml_approved ?? false)
      : (issuerOrg?.aml_approved ?? false);
    const tncAccepted = isInvestorOrg
      ? (investorOrg?.tnc_accepted ?? false)
      : (issuerOrg?.tnc_accepted ?? false);

    const isCompleted = orgOnboardingStatus === "COMPLETED";

    // Use onboarded_at from organization table for completedAt (more accurate than regtank completed_at)
    const onboardedAt = org?.onboarded_at;

    const submittedAt = extractSubmittedAtFromWebhookPayloads({
      webhookPayloads: record.webhook_payloads,
      onboardingStatus: orgOnboardingStatus,
      completedAt: record.completed_at ?? null,
    });

    // Sophisticated investor status (only for investor portal)
    const isSophisticatedInvestor = isInvestorOrg
      ? (investorOrg?.is_sophisticated_investor ?? false)
      : undefined;
    const sophisticatedInvestorReason = isInvestorOrg
      ? (investorOrg?.sophisticated_investor_reason ?? null)
      : undefined;

    // Director KYC status (only for corporate onboarding)
    const directorKycStatusRaw =
      record.organization_type === "COMPANY"
        ? isInvestorOrg
          ? (investorOrg as { director_kyc_status?: unknown })?.director_kyc_status
          : (issuerOrg as { director_kyc_status?: unknown })?.director_kyc_status
        : undefined;

    const directorKycStatus:
      | {
        corpIndvDirectorCount: number;
        corpIndvShareholderCount: number;
        corpBizShareholderCount: number;
        directors: Array<{
          eodRequestId: string;
          name: string;
          email: string;
          role: string;
          kycStatus:
          | "PENDING"
          | "LIVENESS_STARTED"
          | "WAIT_FOR_APPROVAL"
          | "APPROVED"
          | "REJECTED";
          kycId?: string;
          lastUpdated: string;
        }>;
        lastSyncedAt: string;
      }
      | undefined = directorKycStatusRaw
        ? {
          ...(directorKycStatusRaw as {
            corpIndvDirectorCount: number;
            corpIndvShareholderCount: number;
            corpBizShareholderCount: number;
            directors: Array<{
              eodRequestId: string;
              name: string;
              email: string;
              role: string;
              kycStatus: string;
              kycId?: string;
              lastUpdated: string;
            }>;
            lastSyncedAt: string;
          }),
          directors: (
            (
              directorKycStatusRaw as {
                directors: Array<{
                  eodRequestId: string;
                  name: string;
                  email: string;
                  role: string;
                  kycStatus: string;
                  kycId?: string;
                  lastUpdated: string;
                }>;
              }
            ).directors || []
          ).map((d) => ({
            ...d,
            kycStatus: d.kycStatus as
              | "PENDING"
              | "LIVENESS_STARTED"
              | "WAIT_FOR_APPROVAL"
              | "APPROVED"
              | "REJECTED",
          })),
        }
        : undefined;

    // Director AML status (only for corporate onboarding)
    const directorAmlStatusRaw =
      record.organization_type === "COMPANY"
        ? isInvestorOrg
          ? (investorOrg as { director_aml_status?: unknown })?.director_aml_status
          : (issuerOrg as { director_aml_status?: unknown })?.director_aml_status
        : undefined;

    const directorAmlStatus:
      | {
        directors: Array<{
          kycId: string;
          name: string;
          email: string;
          role: string;
          amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
          amlMessageStatus: "DONE" | "PENDING" | "ERROR";
          amlRiskScore: number | null;
          amlRiskLevel: string | null;
          lastUpdated: string;
        }>;
        businessShareholders?: Array<{
          codRequestId: string;
          kybId: string;
          businessName: string;
          sharePercentage?: number | null;
          amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
          amlMessageStatus: "DONE" | "PENDING" | "ERROR";
          amlRiskScore: number | null;
          amlRiskLevel: string | null;
          lastUpdated: string;
        }>;
        lastSyncedAt: string;
      }
      | undefined = directorAmlStatusRaw
        ? {
          ...(directorAmlStatusRaw as {
            directors: Array<{
              kycId: string;
              name: string;
              email: string;
              role: string;
              amlStatus: string;
              amlMessageStatus: string;
              amlRiskScore: number | null;
              amlRiskLevel: string | null;
              lastUpdated: string;
            }>;
            businessShareholders?: Array<{
              codRequestId: string;
              kybId: string;
              businessName: string;
              sharePercentage?: number | null;
              amlStatus: string;
              amlMessageStatus: string;
              amlRiskScore: number | null;
              amlRiskLevel: string | null;
              lastUpdated: string;
            }>;
            lastSyncedAt: string;
          }),
          directors: (
            (
              directorAmlStatusRaw as {
                directors: Array<{
                  kycId: string;
                  name: string;
                  email: string;
                  role: string;
                  amlStatus: string;
                  amlMessageStatus: string;
                  amlRiskScore: number | null;
                  amlRiskLevel: string | null;
                  lastUpdated: string;
                }>;
              }
            ).directors || []
          ).map((d) => ({
            ...d,
            amlStatus: d.amlStatus as "Unresolved" | "Approved" | "Rejected" | "Pending",
            amlMessageStatus: d.amlMessageStatus as "DONE" | "PENDING" | "ERROR",
          })),
          businessShareholders: (
            (
              directorAmlStatusRaw as {
                businessShareholders?: Array<{
                  codRequestId: string;
                  kybId: string;
                  businessName: string;
                  sharePercentage?: number | null;
                  amlStatus: string;
                  amlMessageStatus: string;
                  amlRiskScore: number | null;
                  amlRiskLevel: string | null;
                  lastUpdated: string;
                }>;
              }
            ).businessShareholders || []
          ).map((b) => ({
            ...b,
            amlStatus: b.amlStatus as "Unresolved" | "Approved" | "Rejected" | "Pending",
            amlMessageStatus: b.amlMessageStatus as "DONE" | "PENDING" | "ERROR",
          })),
        }
        : undefined;

    // Corporate entities (only for corporate onboarding)
    const corporateEntitiesRaw =
      record.organization_type === "COMPANY"
        ? isInvestorOrg
          ? (investorOrg as { corporate_entities?: unknown })?.corporate_entities
          : (issuerOrg as { corporate_entities?: unknown })?.corporate_entities
        : undefined;

    const corporateEntities = corporateEntitiesRaw
      ? (corporateEntitiesRaw as {
        directors?: Array<Record<string, unknown>>;
        shareholders?: Array<Record<string, unknown>>;
        corporateShareholders?: Array<Record<string, unknown>>;
      })
      : undefined;

    // Derive organization name and SSM from top-level or corporate_onboarding_data.basicInfo
    const corporateData = org
      ? (org as {
          corporate_onboarding_data?: {
            basicInfo?: {
              businessName?: string | null;
              ssmRegistrationNumber?: string | null;
              ssmRegisterNumber?: string | null;
              entityType?: string | null;
              industry?: string | null;
            };
          };
        }).corporate_onboarding_data
      : undefined;
    const basicInfo = corporateData?.basicInfo;
    const organizationName =
      org?.name ?? basicInfo?.businessName ?? null;
    const registrationNumber =
      org?.registration_number ?? basicInfo?.ssmRegistrationNumber ?? basicInfo?.ssmRegisterNumber ?? null;

    const orgForCtos = isInvestorOrg ? investorOrg : issuerOrg;
    const latestOrganizationCtosCompanyJson =
      orgForCtos?.ctos_reports?.[0]?.company_json ?? null;
    const ctosPartySupplementsRaw = orgForCtos?.ctos_party_supplements;
    const ctosPartySupplements =
      Array.isArray(ctosPartySupplementsRaw) && ctosPartySupplementsRaw.length > 0
        ? ctosPartySupplementsRaw.map((s) => ({
            partyKey: s.party_key,
            onboardingJson: s.onboarding_json ?? null,
          }))
        : null;

    const onboardingPeopleForAml =
      record.organization_type === "COMPANY" && orgForCtos
        ? buildAdminPeopleList({
            ctos: latestOrganizationCtosCompanyJson,
            issuerDirectorKycStatus: directorKycStatusRaw ?? null,
            issuerDirectorAmlStatus: directorAmlStatusRaw ?? null,
            ctosPartySupplements:
              Array.isArray(ctosPartySupplementsRaw) && ctosPartySupplementsRaw.length > 0
                ? ctosPartySupplementsRaw.map((s: { party_key: string; onboarding_json: unknown }) => ({
                    party_key: s.party_key,
                    onboarding_json: s.onboarding_json ?? null,
                  }))
                : null,
            corporateEntities: corporateEntitiesRaw ?? null,
          })
        : [];
    const directorShareholderAmlPending =
      record.organization_type === "COMPANY"
        ? computeHasPendingDirectorShareholder(onboardingPeopleForAml)
        : false;

    return {
      id: record.id,
      userId: record.user.user_id,
      userName: userName || record.user.email,
      userEmail: record.user.email,
      type: record.organization_type as "PERSONAL" | "COMPANY",
      portal: record.portal_type as "investor" | "issuer",
      organizationId: org?.id || "",
      organizationName,
      registrationNumber,
      regtankRequestId: record.request_id,
      regtankStatus: record.status,
      regtankSubstatus: record.substatus,
      regtankPortalUrl,
      kycPortalUrl,
      kybPortalUrl,
      onboardingStatus: orgOnboardingStatus as OnboardingStatusEnum,
      status,
      ssmVerified: ssmApproved,
      ssmVerifiedAt: null,
      ssmVerifiedBy: null,
      submittedAt,
      completedAt: onboardedAt?.toISOString() || null,
      onboardingApproved,
      amlApproved,
      tncAccepted,
      ssmApproved,
      isCompleted,
      isSophisticatedInvestor,
      sophisticatedInvestorReason,
      directorKycStatus,
      directorAmlStatus,
      corporateEntities,
      latestOrganizationCtosCompanyJson,
      ctosPartySupplements,
      directorShareholderAmlPending,
    };
  }

  /**
   * Restart a user's onboarding via RegTank restart API
   * This calls the RegTank restart endpoint which creates a new record with a new requestId,
   * marks the old record as CANCELLED, creates a new record in our DB, and resets org status.
   *
   * @see https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.4-individual-onboarding-endpoint-json-restart-onboarding
   */
  async restartOnboarding(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: boolean; message: string; verifyLink?: string; newRequestId?: string }> {
    // Find the onboarding record
    const onboarding = await this.regTankRepository.findById(onboardingId);
    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // Define statuses that can be restarted
    const restartableStatuses = [
      "REJECTED",
      "EXPIRED",
      "PENDING_APPROVAL",
      "PENDING_AML",
      "LIVENESS_PASSED",
      "WAIT_FOR_APPROVAL",
      "APPROVED",
      "COMPLETED",
      "IN_PROGRESS",
      "PENDING",
    ];

    if (!restartableStatuses.includes(onboarding.status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot restart onboarding in status: ${onboarding.status}`
      );
    }

    // Call RegTank restart API - this returns a NEW requestId
    const regTankResponse = await this.regTankApiClient.restartOnboarding(onboarding.request_id);
    const isCompanyRestart = onboarding.organization_type === OrganizationType.COMPANY;
    const resolvedCompanyRestart = isCompanyRestart
      ? this.resolveCompanyRestartResponse({
        response: regTankResponse as { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown },
        organizationId: onboarding.investor_organization_id || onboarding.issuer_organization_id || null,
        previousRequestId: onboarding.request_id,
        portalType: onboarding.portal_type,
      })
      : null;

    const nextRequestId = resolvedCompanyRestart?.requestId ?? regTankResponse.requestId;
    const nextVerifyLink = resolvedCompanyRestart?.verifyLink ?? regTankResponse.verifyLink;
    const nextExpiredIn = resolvedCompanyRestart?.expiredIn ?? (regTankResponse.expiredIn || 86400);

    const cancelReason = `Restarted by admin ${adminUserId}. New requestId: ${nextRequestId}`;

    // Mark the old onboarding record as cancelled
    await this.regTankRepository.cancelOnboarding(onboardingId, cancelReason);

    const isInvestorPortal = onboarding.portal_type === "investor";
    const context = auditContextFromAdminRequest(req);

    // Determine organization ID
    const organizationId = isInvestorPortal
      ? onboarding.investor_organization_id
      : onboarding.issuer_organization_id;

    // Create new onboarding record with the new requestId from RegTank
    const expiresIn = nextExpiredIn;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Create new onboarding record with PENDING status
    // Status will be set to IN_PROGRESS when user clicks "Yes, Restart Onboarding"
    await this.regTankRepository.createOnboarding({
      userId: onboarding.user_id,
      organizationId: organizationId || undefined,
      organizationType: onboarding.organization_type,
      portalType: onboarding.portal_type,
      requestId: nextRequestId,
      referenceId: `${organizationId}-restart-${Date.now()}`,
      onboardingType: onboarding.onboarding_type,
      verifyLink: nextVerifyLink,
      verifyLinkExpiresAt: expiresAt,
      status: "PENDING",
      regtankResponse: regTankResponse as Prisma.InputJsonValue,
    });

    // Reset the organization's onboarding status to PENDING and clear all approval-related fields
    // User will need to click "Yes, Restart Onboarding" to set it to IN_PROGRESS
    await prisma.$transaction(async (tx) => {
      if (isInvestorPortal && onboarding.investor_organization_id) {
        await tx.investorOrganization.update({
          where: { id: onboarding.investor_organization_id },
          data: {
            onboarding_status: "PENDING",
            is_sophisticated_investor: false,
            onboarding_approved: false,
            aml_approved: false,
            tnc_accepted: false,
            deposit_received: false,
            ssm_approved: false,
            admin_approved_at: null,
            onboarded_at: null,
          },
        });
      } else if (onboarding.issuer_organization_id) {
        await tx.issuerOrganization.update({
          where: { id: onboarding.issuer_organization_id },
          data: {
            onboarding_status: "PENDING",
            onboarding_approved: false,
            aml_approved: false,
            tnc_accepted: false,
            ssm_checked: false,
            admin_approved_at: null,
            onboarded_at: null,
          },
        });
      }

      await writeOnboardingAuditLog(
        {
          eventType: "ONBOARDING_RESTARTED",
          context,
          subjectUserId: onboarding.user_id,
          onboardingId,
          organizationId: organizationId ?? null,
          organizationKind: isInvestorPortal ? "INVESTOR" : "ISSUER",
          organizationType: onboarding.organization_type,
          targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
          targetId: organizationId ?? onboardingId,
          metadata: {
            trigger: ONBOARDING_RESTART_TRIGGER.ADMIN_RESTART,
            previousRequestId: onboarding.request_id,
            newRequestId: nextRequestId,
            previousStatus: onboarding.status,
            onboardingType: onboarding.onboarding_type === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
          },
        },
        tx
      );
    });

    logger.info(
      {
        oldOnboardingId: onboardingId,
        oldRequestId: onboarding.request_id,
        newRequestId: nextRequestId,
        userId: onboarding.user_id,
        previousStatus: onboarding.status,
        adminUserId,
        portalType: onboarding.portal_type,
      },
      "Onboarding restarted by admin via RegTank restart API"
    );

    return {
      success: true,
      message: "Onboarding has been restarted. User will receive a new verification link.",
      verifyLink: nextVerifyLink,
      newRequestId: nextRequestId,
    };
  }

  /**
   * Complete final approval for an onboarding application
   * This marks the organization as fully onboarded after all prerequisite checks are complete
   *
   * Requirements:
   * - Personal (Investor): onboarding_approved, aml_approved, tnc_accepted
   * - Company (Investor/Issuer): onboarding_approved, aml_approved, tnc_accepted, ssm_approved/ssm_checked
   */
  async completeFinalApproval(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    if (org.onboarding_status === OnboardingStatus.PENDING_AMENDMENT) {
      throw new AppError(
        400,
        "REGTANK_AMENDMENT_IN_PROGRESS",
        "RegTank amendment is currently in progress. Please wait until the amended onboarding is resubmitted before approving."
      );
    }

    // Check if already completed
    if (org.onboarding_status === "COMPLETED") {
      throw new AppError(400, "ALREADY_COMPLETED", "Onboarding is already completed");
    }

    if (org.onboarding_status !== OnboardingStatus.PENDING_FINAL_APPROVAL) {
      throw new AppError(
        400,
        "INVALID_STEP",
        "Final approval is only allowed when onboarding_status is PENDING_FINAL_APPROVAL"
      );
    }

    // Get approval flags based on organization type
    const isCompany = onboarding.organization_type === "COMPANY";

    if (isInvestor && onboarding.investor_organization) {
      const investorOrg = onboarding.investor_organization;

      // Check required flags for personal investor
      if (!investorOrg.onboarding_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "Onboarding approval is required");
      }
      if (!investorOrg.aml_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "AML approval is required");
      }
      if (!investorOrg.tnc_accepted) {
        throw new AppError(400, "VALIDATION_ERROR", "Terms and conditions acceptance is required");
      }

      // For company accounts, also check SSM approval and director KYC completion
      if (isCompany) {
        if (!investorOrg.ssm_approved) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "SSM approval is required for company accounts"
          );
        }

        // Check if all directors have completed KYC
        if (investorOrg.director_kyc_status) {
          const directorKycStatus = investorOrg.director_kyc_status as {
            directors: Array<{
              eodRequestId: string;
              name: string;
              email: string;
              role: string;
              kycStatus: string;
              kycId?: string;
              lastUpdated: string;
            }>;
            [key: string]: unknown;
          };

          const pendingDirectors = directorKycStatus.directors.filter(
            (director) => director.kycStatus !== "APPROVED"
          );

          if (pendingDirectors.length > 0) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `All directors/shareholders must complete KYC verification before final approval. ${pendingDirectors.length} director(s) still pending: ${pendingDirectors.map((d) => d.name).join(", ")}`
            );
          }
        }
      }

      // Organization COMPLETED is applied with the audit row below.
    } else if (!isInvestor && onboarding.issuer_organization) {
      const issuerOrg = onboarding.issuer_organization;

      // Check required flags for issuer (always company)
      if (!issuerOrg.onboarding_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "Onboarding approval is required");
      }
      if (!issuerOrg.aml_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "AML approval is required");
      }
      if (!issuerOrg.tnc_accepted) {
        throw new AppError(400, "VALIDATION_ERROR", "Terms and conditions acceptance is required");
      }
      if (!issuerOrg.ssm_checked) {
        throw new AppError(400, "VALIDATION_ERROR", "SSM check is required for issuer accounts");
      }

      // Check if all directors have completed KYC
      if (issuerOrg.director_kyc_status) {
        const directorKycStatus = issuerOrg.director_kyc_status as {
          directors: Array<{
            eodRequestId: string;
            name: string;
            email: string;
            role: string;
            kycStatus: string;
            kycId?: string;
            lastUpdated: string;
          }>;
          [key: string]: unknown;
        };

        const pendingDirectors = directorKycStatus.directors.filter(
          (director) => director.kycStatus !== "APPROVED"
        );

        if (pendingDirectors.length > 0) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            `All directors/shareholders must complete KYC verification before final approval. ${pendingDirectors.length} director(s) still pending: ${pendingDirectors.map((d) => d.name).join(", ")}`
          );
        }
      }

      // Organization COMPLETED is applied with the audit row below.
    }

    const previousOrgStatus = org.onboarding_status;
    const context = auditContextFromAdminRequest(req);
    const claimed = await prisma.$transaction(async (tx) => {
      const won = await claimFinalApprovalCompleted({
        organizationId: org.id,
        portalType: isInvestor ? "investor" : "issuer",
        db: tx,
      });
      if (!won) return false;
      await writeOnboardingAuditLog(
        {
          eventType: "ONBOARDING_FINAL_APPROVAL_COMPLETED",
          context,
          subjectUserId: onboarding.user_id,
          onboardingId,
          organizationId: org.id,
          organizationKind: isInvestor ? "INVESTOR" : "ISSUER",
          organizationType: onboarding.organization_type,
          targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
          targetId: org.id,
          metadata: {
            previousStatus: previousOrgStatus,
            newStatus: "COMPLETED",
            approvedBy: adminUserId,
          },
        },
        tx
      );
      return true;
    });

    if (!claimed) {
      const latest = await readOrganizationOnboardingState(
        prisma,
        isInvestor ? "investor" : "issuer",
        org.id
      );
      if (latest?.onboarding_status === OnboardingStatus.COMPLETED) {
        throw new AppError(400, "ALREADY_COMPLETED", "Onboarding is already completed");
      }
      throw new AppError(
        400,
        "INVALID_STEP",
        "Final approval is only allowed when onboarding_status is PENDING_FINAL_APPROVAL"
      );
    }

    // Update RegTank onboarding status to COMPLETED
    // Status flow: IN_PROGRESS → PENDING_APPROVAL → PENDING_AML → COMPLETED
    // Final approval means all checks (including AML) are done
    const previousRegTankStatus = onboarding.status;

    logger.info(
      {
        onboardingId,
        regtankRequestId: onboarding.request_id,
        organizationId: org.id,
        previousRegTankStatus,
        organizationOnboardingStatus: org.onboarding_status,
        amlApproved: isInvestor
          ? onboarding.investor_organization?.aml_approved
          : onboarding.issuer_organization?.aml_approved,
        note: "About to update regtank_onboarding.status to COMPLETED after final approval",
      },
      "[Final Approval] Current regtank_onboarding status before update"
    );

    await this.regTankRepository.updateStatus(onboarding.request_id, {
      status: "COMPLETED",
      completedAt: new Date(),
    });

    // Refresh corporate entities for company organizations with latest data from RegTank
    if (isCompany && onboarding.request_id) {
      try {
        const codDetails = await this.regTankApiClient.getCorporateOnboardingDetails(onboarding.request_id);
        const corporateEntities = extractCorporateEntities(codDetails);

        if (isInvestor) {
          await prisma.investorOrganization.update({
            where: { id: org.id },
            data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
          });
        } else {
          await prisma.issuerOrganization.update({
            where: { id: org.id },
            data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
          });
        }

        logger.info(
          { organizationId: org.id, codRequestId: onboarding.request_id },
          "Corporate entities refreshed after final approval"
        );
      } catch (refreshError) {
        logger.error(
          {
            error: refreshError instanceof Error ? refreshError.message : String(refreshError),
            organizationId: org.id,
          },
          "Failed to refresh corporate entities after final approval (non-blocking)"
        );
      }
    }

    // Verify the update by fetching the record again
    const updatedOnboarding = await this.regTankRepository.findByRequestId(onboarding.request_id);

    logger.info(
      {
        onboardingId,
        regtankRequestId: onboarding.request_id,
        organizationId: org.id,
        previousRegTankStatus,
        newRegTankStatus: updatedOnboarding?.status || "NOT_FOUND",
        organizationOnboardingStatus: "COMPLETED",
        amlApproved: isInvestor
          ? onboarding.investor_organization?.aml_approved
          : onboarding.issuer_organization?.aml_approved,
        completedAt: updatedOnboarding?.completed_at,
      },
      "[Final Approval] ✓ Successfully updated regtank_onboarding.status to COMPLETED"
    );

    logger.info(
      {
        onboardingId,
        organizationId: org.id,
        userId: onboarding.user_id,
        adminUserId,
        portalType: onboarding.portal_type,
        organizationType: onboarding.organization_type,
      },
      "Final approval completed by admin"
    );

    // Send notification to the user
    try {
      await this.notificationService.sendTyped(
        onboarding.user_id,
        NotificationTypeIds.ONBOARDING_APPROVED,
        {
          onboardingType: onboarding.onboarding_type,
          orgName: onboarding.investor_organization?.name || onboarding.issuer_organization?.name || "your organization",
          portalType: onboarding.portal_type as 'investor' | 'issuer',
        }
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, userId: onboarding.user_id },
        "Failed to send onboarding completion notification"
      );
      // Don't throw error here to not fail the onboarding completion process
    }

    return {
      success: true,
      message: "Onboarding has been completed successfully. The user is now fully onboarded.",
    };
  }

  /**
   * Approve AML screening for an onboarding application
   * Sets aml_approved = true and updates regtank_onboarding.status to APPROVED for corporate
   */
  async approveAmlScreening(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    // Check if AML is already approved
    const isAmlApproved = isInvestor
      ? onboarding.investor_organization?.aml_approved
      : onboarding.issuer_organization?.aml_approved;

    if (isAmlApproved) {
      throw new AppError(400, "ALREADY_APPROVED", "AML screening is already approved");
    }

    if (org.onboarding_status !== OnboardingStatus.PENDING_AML) {
      throw new AppError(
        400,
        "INVALID_STEP",
        "AML approval is only allowed when onboarding_status is PENDING_AML"
      );
    }

    const previousStatus = org.onboarding_status;
    const context = auditContextFromAdminRequest(req);
    const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";

    await prisma.$transaction(async (tx) => {
      const claimed = await claimAmlApproved({
        organizationId: org.id,
        portalType: isInvestor ? "investor" : "issuer",
        db: tx,
      });
      if (!claimed) {
        throw new AppError(400, "ALREADY_APPROVED", "AML screening is already approved");
      }

      await advanceOnboardingStatusFromFlags({
        organizationId: org.id,
        portalType: isInvestor ? "investor" : "issuer",
        reason: "ADMIN_APPROVE_AML_SCREENING",
        db: tx,
      });

      const after = isInvestor
        ? await tx.investorOrganization.findUnique({
            where: { id: org.id },
            select: { onboarding_status: true },
          })
        : await tx.issuerOrganization.findUnique({
            where: { id: org.id },
            select: { onboarding_status: true },
          });

      await writeOnboardingAuditLog(
        {
          eventType: "AML_APPROVED",
          context,
          subjectUserId: onboarding.user_id,
          onboardingId,
          organizationId: org.id,
          organizationKind: isInvestor ? "INVESTOR" : "ISSUER",
          organizationType: onboarding.organization_type,
          targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
          targetId: org.id,
          metadata: {
            provider: "ADMIN",
            screeningKind: isCorporateOnboarding ? "KYB" : "KYC",
            previousApproved: false,
            newApproved: true,
            previousStatus,
            newStatus: after?.onboarding_status,
            trigger: "ADMIN_APPROVE_AML_SCREENING",
          },
        },
        tx
      );

      return after;
    });
    if (isCorporateOnboarding) {
      await this.regTankRepository.updateStatus(onboarding.request_id, {
        status: "APPROVED",
      });

      logger.info(
        {
          onboardingId,
          regtankRequestId: onboarding.request_id,
          organizationId: org.id,
          organizationType: onboarding.organization_type,
          previousRegTankStatus: onboarding.status,
          newRegTankStatus: "APPROVED",
          adminUserId,
        },
        "[AML Approval] Updated regtank_onboarding.status to APPROVED for corporate onboarding"
      );
    }

    logger.info(
      {
        onboardingId,
        organizationId: org.id,
        userId: onboarding.user_id,
        adminUserId,
        portalType: onboarding.portal_type,
        organizationType: onboarding.organization_type,
        isCorporateOnboarding,
      },
      "AML screening approved by admin"
    );

    return {
      success: true,
      message: isCorporateOnboarding
        ? "AML screening approved. RegTank onboarding status updated to APPROVED. Organization moved to final approval."
        : "AML screening approved. Organization moved to final approval.",
    };
  }

  /**
   * Approve SSM verification for a company organization
   * Sets ssm_approved / ssm_checked and advances onboarding_status to PENDING_APPROVAL.
   */
  async approveSsmVerification(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // SSM verification only applies to company type
    if (onboarding.organization_type !== "COMPANY") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "SSM verification is only applicable for company accounts"
      );
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    if (org.onboarding_status === OnboardingStatus.PENDING_AMENDMENT) {
      throw new AppError(
        400,
        "REGTANK_AMENDMENT_IN_PROGRESS",
        "RegTank amendment is currently in progress. Please wait until the amended onboarding is resubmitted before approving."
      );
    }

    if (org.onboarding_status !== OnboardingStatus.PENDING_SSM_REVIEW) {
      throw new AppError(
        400,
        "INVALID_STEP",
        "CTOS approval is only allowed when onboarding_status is PENDING_SSM_REVIEW"
      );
    }

    const previousSsmApproved = isInvestor
      ? Boolean(onboarding.investor_organization?.ssm_approved)
      : Boolean(onboarding.issuer_organization?.ssm_checked);
    const context = auditContextFromAdminRequest(req);

    await prisma.$transaction(async (tx) => {
      const claimed = await claimSsmApproved({
        organizationId: org.id,
        portalType: isInvestor ? "investor" : "issuer",
        db: tx,
      });
      if (!claimed) {
        throw new AppError(
          400,
          "INVALID_STEP",
          "CTOS approval is only allowed when onboarding_status is PENDING_SSM_REVIEW"
        );
      }

      await writeOnboardingAuditLog(
        {
          eventType: "SSM_APPROVED",
          context,
          subjectUserId: onboarding.user_id,
          onboardingId,
          organizationId: org.id,
          organizationKind: isInvestor ? "INVESTOR" : "ISSUER",
          organizationType: onboarding.organization_type,
          targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
          targetId: org.id,
          metadata: {
            previousSsmApproved,
            newSsmApproved: true,
            previousStatus: org.onboarding_status,
            newStatus: OnboardingStatus.PENDING_APPROVAL,
          },
        },
        tx
      );

      await advanceOnboardingStatusFromFlags({
        organizationId: org.id,
        portalType: isInvestor ? "investor" : "issuer",
        reason: "ADMIN_APPROVE_SSM_VERIFICATION",
        db: tx,
      });
    });

    logger.info(
      {
        onboardingId,
        organizationId: org.id,
        userId: onboarding.user_id,
        adminUserId,
        portalType: onboarding.portal_type,
      },
      "SSM verification approved by admin"
    );

    return {
      success: true,
      message: "SSM verification has been approved successfully.",
    };
  }

  /**
   * Records admin onboarding approval after RegTank review; sets onboarding_approved and applies flag-driven status advance.
   */
  async approveOnboardingSubmission(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string }> {
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    if (org.onboarding_status === OnboardingStatus.PENDING_AMENDMENT) {
      throw new AppError(
        400,
        "REGTANK_AMENDMENT_IN_PROGRESS",
        "RegTank amendment is currently in progress. Please wait until the amended onboarding is resubmitted before approving."
      );
    }

    if (org.onboarding_status !== OnboardingStatus.PENDING_APPROVAL) {
      throw new AppError(
        400,
        "INVALID_STEP",
        "Onboarding approval is only allowed when onboarding_status is PENDING_APPROVAL"
      );
    }

    const onboardingApproved = isInvestor
      ? onboarding.investor_organization?.onboarding_approved
      : onboarding.issuer_organization?.onboarding_approved;

    if (onboardingApproved) {
      throw new AppError(400, "ALREADY_APPROVED", "Onboarding has already been approved");
    }

    const previousStatus = org.onboarding_status;
    const context = auditContextFromAdminRequest(req);

    await prisma.$transaction(async (tx) => {
      const claimed = await claimOnboardingApproved({
        organizationId: org.id,
        portalType: isInvestor ? "investor" : "issuer",
        db: tx,
      });
      if (!claimed) {
        const latest = await readOrganizationOnboardingState(
          tx,
          isInvestor ? "investor" : "issuer",
          org.id
        );
        if (latest?.onboarding_approved) {
          throw new AppError(400, "ALREADY_APPROVED", "Onboarding has already been approved");
        }
        throw new AppError(
          400,
          "INVALID_STEP",
          "Onboarding approval is only allowed when onboarding_status is PENDING_APPROVAL"
        );
      }

      await advanceOnboardingStatusFromFlags({
        organizationId: org.id,
        portalType: isInvestor ? "investor" : "issuer",
        reason: "ADMIN_APPROVE_ONBOARDING_SUBMISSION",
        db: tx,
      });

      const after = isInvestor
        ? await tx.investorOrganization.findUnique({
            where: { id: org.id },
            select: { onboarding_status: true },
          })
        : await tx.issuerOrganization.findUnique({
            where: { id: org.id },
            select: { onboarding_status: true },
          });

      await writeOnboardingAuditLog(
        {
          eventType: "ONBOARDING_APPROVED",
          context,
          subjectUserId: onboarding.user_id,
          onboardingId,
          organizationId: org.id,
          organizationKind: isInvestor ? "INVESTOR" : "ISSUER",
          organizationType: onboarding.organization_type,
          targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
          targetId: org.id,
          metadata: {
            previousApproved: false,
            newApproved: true,
            previousStatus,
            newStatus: after?.onboarding_status,
            trigger: "ADMIN_APPROVE_ONBOARDING_SUBMISSION",
          },
        },
        tx
      );
    });

    logger.info(
      {
        onboardingId,
        organizationId: org.id,
        adminUserId,
        portalType: onboarding.portal_type,
      },
      "Onboarding submission approved by admin"
    );

    return {
      success: true,
      message: "Onboarding approved. Organization onboarding status was updated from current flags.",
    };
  }

  /**
   * Refresh corporate onboarding status by fetching latest director KYC statuses from RegTank
   * Fetches COD details and EOD details for each director to update their KYC statuses
   */
  async refreshCorporateOnboardingStatus(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{
    success: true;
    message: string;
    directorsUpdated: number;
    onboardingStatus: OnboardingStatus;
    onboardingApproved: boolean;
    onboardingProviderStatus: string | null;
    advanced: boolean;
  }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // Only applicable for corporate onboarding
    if (onboarding.onboarding_type !== "CORPORATE") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Refresh corporate status is only applicable for corporate onboarding"
      );
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const codRequestId = onboarding.request_id;

    try {
      // Fetch COD details from RegTank API
      logger.info(
        { codRequestId, organizationId: org.id, adminUserId },
        "Fetching COD details to refresh director KYC statuses"
      );

      const codDetails = await this.regTankApiClient.getCorporateOnboardingDetails(codRequestId);

      // Resolve the org-level onboarding-approval milestone from the live COD status.
      // Only an exact "APPROVED" COD result may set onboarding_approved — mirrors the
      // COD webhook rule (shouldApplyCodApprovedOnboardingFlag) so a missed webhook can
      // be recovered by refresh without ever regressing an org already past this stage.
      const codStatusRaw =
        typeof (codDetails as Record<string, unknown>).status === "string"
          ? ((codDetails as Record<string, unknown>).status as string)
          : null;
      const codStatusUpper = codStatusRaw?.toUpperCase() ?? null;

      if (codStatusRaw) {
        try {
          await this.regTankRepository.updateStatus(codRequestId, {
            status: normalizeRawStatus(codStatusRaw),
            regtankResponse: codDetails as Prisma.InputJsonValue,
          });
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : String(error), requestId: codRequestId },
            "[Admin Refresh] Failed to persist refreshed corporate onboarding status (non-blocking)"
          );
        }
      }

      let onboardingApproved = Boolean(org.onboarding_approved);
      let onboardingStatusResult = org.onboarding_status;
      let onboardingAdvanced = false;

      if (codStatusUpper === "APPROVED") {
        const shouldApply = shouldApplyCodApprovedOnboardingFlag({
          currentOnboardingStatus: org.onboarding_status,
          onboardingApproved: org.onboarding_approved,
        });

        if (shouldApply) {
          const context = auditContextFromAdminRequest(req);
          await prisma.$transaction(async (tx) => {
            const claimed = await claimOnboardingApproved({
              organizationId: org.id,
              portalType: isInvestor ? "investor" : "issuer",
              db: tx,
            });
            if (!claimed) return;
            await writeOnboardingAuditLog(
              {
                eventType: "ONBOARDING_APPROVED",
                context,
                subjectUserId: onboarding.user_id,
                onboardingId,
                organizationId: org.id,
                organizationKind: isInvestor ? "INVESTOR" : "ISSUER",
                organizationType: onboarding.organization_type,
                targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
                targetId: org.id,
                metadata: {
                  previousApproved: false,
                  newApproved: true,
                  previousStatus: org.onboarding_status,
                  trigger: "ADMIN_MANUAL_ONBOARDING_REFRESH",
                },
              },
              tx
            );
          });
          onboardingApproved = true;
        }

        const { changed } = await advanceOnboardingStatusFromFlags({
          organizationId: org.id,
          portalType: isInvestor ? "investor" : "issuer",
          reason: "ADMIN_MANUAL_ONBOARDING_REFRESH",
        });
        onboardingAdvanced = changed;

        const afterOrg = isInvestor
          ? await prisma.investorOrganization.findUnique({ where: { id: org.id }, select: { onboarding_status: true } })
          : await prisma.issuerOrganization.findUnique({ where: { id: org.id }, select: { onboarding_status: true } });
        onboardingStatusResult = afterOrg?.onboarding_status ?? onboardingStatusResult;
      }

      const mergeRoleLabels = (existingRole: string, incomingRole: string): string => {
        const roleSet = new Set(
          `${existingRole || ""},${incomingRole || ""}`
            .split(",")
            .map((role) => role.trim())
            .filter((role) => role.length > 0)
        );
        return Array.from(roleSet).join(", ");
      };
      const mapEodStatusToKycStatus = (eodStatus: string, fallback: string): string => {
        if (eodStatus === "LIVENESS_STARTED") return "LIVENESS_STARTED";
        if (eodStatus === "WAIT_FOR_APPROVAL") return "WAIT_FOR_APPROVAL";
        if (eodStatus === "APPROVED") return "APPROVED";
        if (eodStatus === "REJECTED") return "REJECTED";
        if (eodStatus === "EXPIRED") return "EXPIRED";
        return fallback;
      };

      // Deduplicate by government ID → name → EOD (never email alone)
      const directorsMap = new Map<string, {
        eodRequestId: string; // Keep director EOD ID as primary
        shareholderEodRequestId?: string; // Track shareholder EOD ID if different
        name: string;
        email: string;
        role: string;
        kycStatus: string;
        kycId?: string;
        governmentIdNumber?: string;
        lastUpdated: string;
      }>();

      // Process individual directors
      if (codDetails.corpIndvDirectors && Array.isArray(codDetails.corpIndvDirectors)) {
        for (const director of codDetails.corpIndvDirectors) {
          const eodRequestId = director.corporateIndividualRequest?.requestId || "";
          const userInfo = director.corporateUserRequestInfo;
          const formContent = userInfo?.formContent?.content || [];

          // Extract name, email, role from formContent
          type FormField = { fieldName: string; fieldValue: string };
          const typedFormContent = formContent as FormField[];
          const firstName =
            typedFormContent.find((f) => f.fieldName === "First Name")?.fieldValue || "";
          const lastName =
            typedFormContent.find((f) => f.fieldName === "Last Name")?.fieldValue || "";
          const designation =
            typedFormContent.find((f) => f.fieldName === "Designation")?.fieldValue || "";
          const email =
            typedFormContent.find((f) => f.fieldName === "Email Address")?.fieldValue ||
            userInfo?.email ||
            "";
          const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
          const governmentIdNumber =
            extractGovernmentIdFromCorporateUserInfo(userInfo as Record<string, unknown>) || undefined;

          const mapKey = resolveCorporatePersonMergeKey({
            governmentIdNumber,
            name,
            eodRequestId,
          });

          // Fetch EOD details to get latest KYC status
          let kycStatus = director.corporateIndividualRequest?.status || "PENDING";
          let kycId = director.kycRequestInfo?.kycId;

          if (eodRequestId) {
            try {
              const eodDetails =
                await this.regTankApiClient.getEntityOnboardingDetails(eodRequestId);
              const eodStatus = eodDetails.corporateIndividualRequest?.status?.toUpperCase() || "";

              kycStatus = mapEodStatusToKycStatus(eodStatus, kycStatus);

              // Get KYC ID from EOD details if available
              if (eodDetails.kycRequestInfo?.kycId) {
                kycId = eodDetails.kycRequestInfo.kycId;
              }
            } catch (eodError) {
              logger.warn(
                {
                  error: eodError instanceof Error ? eodError.message : String(eodError),
                  eodRequestId,
                  codRequestId,
                },
                "Failed to fetch EOD details for director (non-blocking)"
              );
            }
          }

          directorsMap.set(mapKey, {
            eodRequestId,
            name,
            email,
            role: designation || "Director",
            kycStatus,
            kycId,
            governmentIdNumber,
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      // Process individual shareholders
      // If they already exist as directors, merge the roles; otherwise add as new entry
      if (codDetails.corpIndvShareholders && Array.isArray(codDetails.corpIndvShareholders)) {
        for (const shareholder of codDetails.corpIndvShareholders) {
          const shareholderEodRequestId = shareholder.corporateIndividualRequest?.requestId || "";
          const userInfo = shareholder.corporateUserRequestInfo;
          const formContent = userInfo?.formContent?.content || [];

          type FormField = { fieldName: string; fieldValue: string };
          const typedFormContent = formContent as FormField[];
          const firstName =
            typedFormContent.find((f) => f.fieldName === "First Name")?.fieldValue || "";
          const lastName =
            typedFormContent.find((f) => f.fieldName === "Last Name")?.fieldValue || "";
          const email =
            typedFormContent.find((f) => f.fieldName === "Email Address")?.fieldValue ||
            userInfo?.email ||
            "";
          const sharePercent =
            typedFormContent.find((f) => f.fieldName === "% of Shares")?.fieldValue || "";
          const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
          const shareholderGovernmentId =
            extractGovernmentIdFromCorporateUserInfo(userInfo as Record<string, unknown>) || undefined;

          const mapKey = resolveCorporatePersonMergeKey({
            governmentIdNumber: shareholderGovernmentId,
            name,
            eodRequestId: shareholderEodRequestId,
          });
          const existingDirector = directorsMap.get(mapKey);
          const shareholderRole = `Shareholder${sharePercent ? ` (${sharePercent}%)` : ""}`;

          // Fetch EOD details to get latest KYC status
          let kycStatus = shareholder.corporateIndividualRequest?.status || "PENDING";
          let kycId = shareholder.kycRequestInfo?.kycId;

          if (shareholderEodRequestId) {
            try {
              const eodDetails =
                await this.regTankApiClient.getEntityOnboardingDetails(shareholderEodRequestId);
              const eodStatus = eodDetails.corporateIndividualRequest?.status?.toUpperCase() || "";

              kycStatus = mapEodStatusToKycStatus(eodStatus, kycStatus);

              if (eodDetails.kycRequestInfo?.kycId) {
                kycId = eodDetails.kycRequestInfo.kycId;
              }
            } catch (eodError) {
              logger.warn(
                {
                  error: eodError instanceof Error ? eodError.message : String(eodError),
                  eodRequestId: shareholderEodRequestId,
                  codRequestId,
                },
                "Failed to fetch EOD details for shareholder (non-blocking)"
              );
            }
          }

          if (existingDirector) {
            // Person is both director and shareholder - merge roles
            existingDirector.role = mergeRoleLabels(existingDirector.role, shareholderRole);
            existingDirector.shareholderEodRequestId = shareholderEodRequestId;

            // Fetch both EOD details to check which one has kycId
            let directorKycId: string | undefined;
            let shareholderKycId: string | undefined;

            // Fetch director EOD details
            if (existingDirector.eodRequestId) {
              try {
                const directorEodDetails = await this.regTankApiClient.getEntityOnboardingDetails(existingDirector.eodRequestId);
                directorKycId = directorEodDetails.kycRequestInfo?.kycId;
              } catch (eodError) {
                logger.warn(
                  {
                    error: eodError instanceof Error ? eodError.message : String(eodError),
                    eodRequestId: existingDirector.eodRequestId,
                    codRequestId,
                  },
                  "Failed to fetch director EOD details for kycId check (non-blocking)"
                );
              }
            }

            // Fetch shareholder EOD details
            if (shareholderEodRequestId) {
              try {
                const shareholderEodDetails = await this.regTankApiClient.getEntityOnboardingDetails(shareholderEodRequestId);
                shareholderKycId = shareholderEodDetails.kycRequestInfo?.kycId;
              } catch (eodError) {
                logger.warn(
                  {
                    error: eodError instanceof Error ? eodError.message : String(eodError),
                    eodRequestId: shareholderEodRequestId,
                    codRequestId,
                  },
                  "Failed to fetch shareholder EOD details for kycId check (non-blocking)"
                );
              }
            }

            // Use kycId from whichever EOD record has it (prioritize director if both have it)
            if (directorKycId) {
              existingDirector.kycId = directorKycId;
            } else if (shareholderKycId) {
              existingDirector.kycId = shareholderKycId;
            } else {
              // Fallback to COD response if EOD details don't have it
              if (kycId && !existingDirector.kycId) {
                existingDirector.kycId = kycId;
              }
            }

            // Update KYC status if shareholder has a more recent or different status
            // Prioritize APPROVED > WAIT_FOR_APPROVAL > LIVENESS_STARTED > PENDING
            const statusPriority = {
              APPROVED: 4,
              WAIT_FOR_APPROVAL: 3,
              LIVENESS_STARTED: 2,
              PENDING: 1,
              REJECTED: 0,
            };
            const currentPriority = statusPriority[existingDirector.kycStatus as keyof typeof statusPriority] || 0;
            const newPriority = statusPriority[kycStatus as keyof typeof statusPriority] || 0;
            if (newPriority > currentPriority) {
              existingDirector.kycStatus = kycStatus;
            }

            if (!existingDirector.governmentIdNumber && shareholderGovernmentId) {
              existingDirector.governmentIdNumber = shareholderGovernmentId;
            }

            existingDirector.lastUpdated = new Date().toISOString();
          } else {
            // Person is only a shareholder - add as new entry
            directorsMap.set(mapKey, {
              eodRequestId: shareholderEodRequestId,
              name,
              email,
              role: shareholderRole,
              kycStatus,
              kycId,
              governmentIdNumber: shareholderGovernmentId,
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      }

      // Convert Map to Array
      const directors = Array.from(directorsMap.values());

      // Update organization with refreshed director KYC statuses
      const directorKycStatus = {
        corpIndvDirectorCount: codDetails.corpIndvDirectorCount || 0,
        corpIndvShareholderCount: codDetails.corpIndvShareholderCount || 0,
        corpBizShareholderCount: codDetails.corpBizShareholderCount || 0,
        directors,
        lastSyncedAt: new Date().toISOString(),
      };

      // Refresh corporate shareholders status from COD details
      let corporateEntitiesUpdated = false;
      let updatedCorporateEntities: Record<string, unknown> | null = null;
      const extractedCorporateEntities = extractCorporateEntities(codDetails);
      const existingOrg = isInvestor
        ? await prisma.investorOrganization.findUnique({
          where: { id: org.id },
          select: { corporate_entities: true },
        })
        : await prisma.issuerOrganization.findUnique({
          where: { id: org.id },
          select: { corporate_entities: true },
        });

      if (existingOrg) {
        const corporateEntities = (existingOrg.corporate_entities as Record<string, unknown>) || {
          directors: [],
          shareholders: [],
          corporateShareholders: [],
        };
        let updated = false;

        // Always persist latest individual director/shareholder entities from live COD.
        corporateEntities.directors = Array.isArray(extractedCorporateEntities.directors)
          ? extractedCorporateEntities.directors
          : [];
        corporateEntities.shareholders = Array.isArray(extractedCorporateEntities.shareholders)
          ? extractedCorporateEntities.shareholders
          : [];
        updated = true;

        // Update corporate shareholders with latest status from COD details
        if (corporateEntities.corporateShareholders && Array.isArray(corporateEntities.corporateShareholders)) {
          const codCorpShareholders = Array.isArray(codDetails.corpBizShareholders)
            ? (codDetails.corpBizShareholders as Record<string, unknown>[])
            : [];

          // Create a map of existing corporate shareholders by COD requestId or company name
          const existingMap = new Map<string, Record<string, unknown>>();
          for (const existing of corporateEntities.corporateShareholders) {
            const key =
              existing.corporateOnboardingRequest?.requestId ||
              existing.requestId ||
              existing.name ||
              "";
            if (key) {
              existingMap.set(key, existing);
            }
          }

          // Update existing corporate shareholders with latest status from COD details
          for (const codShareholder of codCorpShareholders) {
            const codCorpReq = codShareholder.corporateOnboardingRequest as Record<string, unknown> | undefined;
            const codRequestId =
              (codCorpReq?.requestId as string) ||
              (codShareholder.requestId as string) ||
              "";
            const codName = (codShareholder.name as string) || (codShareholder.businessName as string) || "";
            const key = codRequestId || codName;

            if (key) {
              const existing = existingMap.get(key);
              if (existing) {
                // Update status and other fields from COD details
                const updatedShareholder = {
                  ...existing,
                  ...codShareholder,
                  // Preserve fields we want to keep from existing
                  lastUpdated: new Date().toISOString(),
                };

                // Replace in array
                const index = (corporateEntities.corporateShareholders as Record<string, unknown>[]).findIndex(
                  (s: Record<string, unknown>) =>
                    (((s.corporateOnboardingRequest as Record<string, unknown>)?.requestId as string) || (s.requestId as string) || (s.name as string) || "") === key
                );
                if (index !== -1) {
                  (corporateEntities.corporateShareholders as Record<string, unknown>[])[index] = updatedShareholder;
                  updated = true;
                  logger.debug(
                    {
                      codRequestId,
                      name: codName,
                      status:
                        (codShareholder.status as string) ||
                        (codCorpReq?.status as string),
                    },
                    "[Admin Refresh] Updated corporate shareholder status from COD details"
                  );
                }
              } else {
                // New corporate shareholder - add it
                (corporateEntities.corporateShareholders as Record<string, unknown>[]).push({
                  ...codShareholder,
                  lastUpdated: new Date().toISOString(),
                });
                updated = true;
                logger.debug(
                  {
                    codRequestId,
                    name: codName,
                  },
                  "[Admin Refresh] Added new corporate shareholder from COD details"
                );
              }
            }
          }
        } else if (
          codDetails.corpBizShareholders &&
          Array.isArray(codDetails.corpBizShareholders) &&
          codDetails.corpBizShareholders.length > 0
        ) {
          // No existing corporate shareholders, but COD has them - initialize the array
          corporateEntities.corporateShareholders = (codDetails.corpBizShareholders as Record<string, unknown>[]).map(
            (corpShareholder: Record<string, unknown>) => ({
              ...corpShareholder,
              lastUpdated: new Date().toISOString(),
            })
          );
          updated = true;
          logger.debug(
            {
              count: codDetails.corpBizShareholders.length,
            },
            "[Admin Refresh] Initialized corporate shareholders array from COD details"
          );
        }

        if (updated) {
          corporateEntitiesUpdated = true;
          updatedCorporateEntities = corporateEntities;
        }

        // If organization is in PENDING_AML stage, fetch/refresh all AML statuses using AMLFetcherService
        if (org.onboarding_status === "PENDING_AML") {
          try {
            logger.info(
              { codRequestId, organizationId: org.id },
              "[Admin Refresh] Fetching all AML statuses using AMLFetcherService"
            );

            const amlFetcher = new AMLFetcherService();
            await amlFetcher.fetchAllAMLStatuses(codRequestId, org.id, onboarding.portal_type as PortalType);

            logger.info(
              { codRequestId, organizationId: org.id },
              "[Admin Refresh] ✓ Completed fetching all AML statuses"
            );
          } catch (amlError) {
            logger.warn(
              {
                error: amlError instanceof Error ? amlError.message : String(amlError),
                codRequestId,
                organizationId: org.id,
              },
              "[Admin Refresh] Failed to fetch AML statuses (non-blocking)"
            );
          }
        }
      }

      // Update organization with refreshed director KYC statuses and corporate entities
      const refreshContext = auditContextFromAdminRequest(req);
      const refreshPortal = isInvestor ? "investor" : "issuer";
      await prisma.$transaction(async (tx) => {
        await lockOrganizationRow(tx, refreshPortal, org.id);
        const locked =
          isInvestor
            ? await tx.investorOrganization.findUnique({
                where: { id: org.id },
                select: { director_kyc_status: true, corporate_entities: true },
              })
            : await tx.issuerOrganization.findUnique({
                where: { id: org.id },
                select: { director_kyc_status: true, corporate_entities: true },
              });
        if (!locked) return;

        const updateData: {
          director_kyc_status: Prisma.InputJsonValue;
          corporate_entities?: Prisma.InputJsonValue;
        } = {
          director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
        };
        if (corporateEntitiesUpdated && updatedCorporateEntities) {
          updateData.corporate_entities = updatedCorporateEntities as Prisma.InputJsonValue;
        }

        if (isInvestor) {
          await tx.investorOrganization.update({
            where: { id: org.id },
            data: updateData,
          });
        } else {
          await tx.issuerOrganization.update({
            where: { id: org.id },
            data: updateData,
          });
        }

        await writeDirectorKycOutcomeAuditLogs(
          {
            outcomes: directorKycFinalOutcomes(locked.director_kyc_status, directorKycStatus),
            context: refreshContext,
            subjectUserId: onboarding.user_id,
            onboardingId,
            organizationId: org.id,
            organizationKind: isInvestor ? "INVESTOR" : "ISSUER",
            organizationType: "COMPANY",
          },
          tx
        );
      });

      logger.info(
        {
          onboardingId,
          codRequestId,
          organizationId: org.id,
          adminUserId,
          directorsUpdated: directors.length,
          corporateShareholdersUpdated: corporateEntitiesUpdated,
        },
        "Refreshed corporate onboarding director KYC statuses and corporate shareholders"
      );

      return {
        success: true,
        message: onboardingAdvanced
          ? "RegTank onboarding approved. Onboarding has advanced to AML Approval."
          : `Successfully refreshed ${directors.length} director KYC status${directors.length !== 1 ? "es" : ""}${corporateEntitiesUpdated ? " and corporate shareholders status" : ""}.`,
        directorsUpdated: directors.length,
        onboardingStatus: onboardingStatusResult,
        onboardingApproved,
        onboardingProviderStatus: codStatusRaw,
        advanced: onboardingAdvanced,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          onboardingId,
          codRequestId,
          organizationId: org.id,
          adminUserId,
        },
        "Failed to refresh corporate onboarding status"
      );
      throw new AppError(
        500,
        "REFRESH_FAILED",
        `Failed to refresh corporate onboarding status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Refresh corporate AML status for all directors, shareholders, and business shareholders
   * Uses AMLFetcherService to fetch latest AML statuses from RegTank
   */
  async refreshCorporateAmlStatus(
    _req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{
    success: true;
    message: string;
    directorsUpdated: number;
    onboardingStatus: OnboardingStatus;
    amlApproved: boolean;
    advanced: boolean;
  }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // Only applicable for corporate onboarding
    if (onboarding.onboarding_type !== "CORPORATE") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Refresh corporate AML status is only applicable for corporate onboarding"
      );
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const codRequestId = onboarding.request_id;
    const portalType = onboarding.portal_type as PortalType;

    try {
      logger.info(
        { onboardingId, organizationId: org.id, adminUserId, codRequestId },
        "Refreshing corporate AML statuses using AMLFetcherService"
      );

      // Use AMLFetcherService to fetch all AML statuses (per-director/shareholder display data)
      const amlFetcher = new AMLFetcherService();
      await amlFetcher.fetchAllAMLStatuses(codRequestId, org.id, portalType);

      // Get updated director_aml_status to count directors
      const updatedOrg = isInvestor
        ? await prisma.investorOrganization.findUnique({
          where: { id: org.id },
          select: { director_aml_status: true },
        })
        : await prisma.issuerOrganization.findUnique({
          where: { id: org.id },
          select: { director_aml_status: true },
        });

      const directorAmlStatus = (updatedOrg?.director_aml_status as Record<string, unknown>) || { directors: [] };
      const directorsCount = Array.isArray(directorAmlStatus.directors) ? directorAmlStatus.directors.length : 0;

      // Resolve the org-level AML milestone from the main company's live KYB status.
      // This is the shared helper used by webhooks — never duplicate its approval logic here.
      const milestone = await applyCorporateAmlMilestoneFromLiveKyb({
        organizationId: org.id,
        portalType,
        userId: adminUserId,
        organizationName: org.name,
        codRequestId,
        trigger: "ADMIN_MANUAL_AML_REFRESH",
        onboardingId,
      });

      logger.info(
        {
          onboardingId,
          organizationId: org.id,
          adminUserId,
          directorsUpdated: directorsCount,
          milestoneAdvanced: milestone.advanced,
          onboardingStatus: milestone.onboardingStatus,
        },
        "Refreshed corporate AML statuses"
      );

      return {
        success: true,
        message: milestone.advanced
          ? "AML screening approved. Onboarding has advanced to Final Approval."
          : `Successfully refreshed ${directorsCount} director AML status${directorsCount !== 1 ? "es" : ""}. RegTank approval is still pending.`,
        directorsUpdated: directorsCount,
        onboardingStatus: milestone.onboardingStatus ?? org.onboarding_status,
        amlApproved: milestone.amlApproved,
        advanced: milestone.advanced,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          onboardingId,
          organizationId: org.id,
          adminUserId,
        },
        "Failed to refresh corporate AML status"
      );
      throw new AppError(
        500,
        "REFRESH_FAILED",
        `Failed to refresh corporate AML status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Admin "Refresh status" — stage-aware live RegTank refresh used by the onboarding
   * review modal. Consistently queries RegTank for both personal and company
   * investor/issuer organizations, updates existing stored fields/JSON via the
   * existing handlers below, then runs the existing shared milestone/advancement
   * helpers. Never sets `ssm_approved`/`ssm_checked` — that remains an explicit admin
   * decision (see `approveSsmVerification`).
   */
  async refreshOnboardingStatus(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{
    success: true;
    message: string;
    organizationId: string;
    onboardingStatus: OnboardingStatus;
    onboardingApproved: boolean;
    ssmApproved: boolean;
    amlApproved: boolean;
    advanced: boolean;
    onboardingProviderStatus: string | null;
    amlProviderStatus: string | null;
    lastSyncedAt: string | null;
    directorsUpdated: number;
    refreshedSources: string[];
    warnings: string[];
    partialFailures: string[];
  }> {
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
      },
    });
    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const readSsmApproved = async (): Promise<boolean> => {
      if (isInvestor) {
        const row = await prisma.investorOrganization.findUnique({ where: { id: org.id }, select: { ssm_approved: true } });
        return Boolean(row?.ssm_approved);
      }
      const row = await prisma.issuerOrganization.findUnique({ where: { id: org.id }, select: { ssm_checked: true } });
      return Boolean(row?.ssm_checked);
    };

    // Terminal states: never re-query or mutate a finished/rejected organization —
    // avoids wasted RegTank calls and guarantees no regression is even possible.
    if (org.onboarding_status === OnboardingStatus.COMPLETED || org.onboarding_status === OnboardingStatus.REJECTED) {
      return {
        success: true,
        message: "RegTank status is already up to date.",
        organizationId: org.id,
        onboardingStatus: org.onboarding_status,
        onboardingApproved: Boolean(org.onboarding_approved),
        ssmApproved: await readSsmApproved(),
        amlApproved: Boolean(org.aml_approved),
        advanced: false,
        onboardingProviderStatus: onboarding.status,
        amlProviderStatus: null,
        lastSyncedAt: new Date().toISOString(),
        directorsUpdated: 0,
        refreshedSources: [],
        warnings: [],
        partialFailures: [],
      };
    }

    if (onboarding.onboarding_type === "CORPORATE") {
      const warnings: string[] = [];
      const partialFailures: string[] = [];
      const refreshedSources: string[] = ["COD", "EOD"];

      let onboardingResult: {
        onboardingStatus: OnboardingStatus;
        onboardingApproved: boolean;
        onboardingProviderStatus: string | null;
        directorsUpdated: number;
        advanced: boolean;
      };
      try {
        onboardingResult = await this.refreshCorporateOnboardingStatus(req, onboardingId, adminUserId);
      } catch (error) {
        partialFailures.push("COD");
        warnings.push(
          `Failed to refresh RegTank corporate onboarding data: ${error instanceof Error ? error.message : String(error)}`
        );
        const fallback = isInvestor
          ? await prisma.investorOrganization.findUnique({ where: { id: org.id }, select: { onboarding_status: true, onboarding_approved: true } })
          : await prisma.issuerOrganization.findUnique({ where: { id: org.id }, select: { onboarding_status: true, onboarding_approved: true } });
        onboardingResult = {
          onboardingStatus: fallback?.onboarding_status ?? org.onboarding_status,
          onboardingApproved: Boolean(fallback?.onboarding_approved),
          onboardingProviderStatus: null,
          directorsUpdated: 0,
          advanced: false,
        };
      }

      let amlResult: { onboardingStatus: OnboardingStatus; amlApproved: boolean; advanced: boolean; directorsUpdated: number } | null = null;
      try {
        amlResult = await this.refreshCorporateAmlStatus(req, onboardingId, adminUserId);
        refreshedSources.push("KYB", "RELATED_PARTY_AML");
      } catch (error) {
        partialFailures.push("KYB");
        warnings.push(
          `Failed to refresh RegTank AML/KYB screening data: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const finalStatus = amlResult?.onboardingStatus ?? onboardingResult.onboardingStatus;
      const advanced = onboardingResult.advanced || Boolean(amlResult?.advanced);
      const ssmApproved = await readSsmApproved();

      let message: string;
      if (advanced) {
        message = onboardingResult.advanced
          ? "RegTank status refreshed. Onboarding has advanced to AML Approval."
          : "RegTank screening status refreshed. Onboarding has advanced to Final Approval.";
      } else if (partialFailures.length > 0) {
        message = "RegTank status was partially refreshed. Some related-party records could not be updated.";
      } else if (finalStatus === OnboardingStatus.PENDING_SSM_REVIEW) {
        message = "RegTank onboarding data refreshed. Complete the SSM/CTOS verification before continuing.";
      } else if (finalStatus === OnboardingStatus.PENDING_AML) {
        message = "RegTank screening status refreshed. AML approval is still pending.";
      } else if (finalStatus === OnboardingStatus.PENDING_APPROVAL) {
        message = "RegTank status refreshed. RegTank approval is still pending.";
      } else {
        message = "RegTank status refreshed.";
      }

      return {
        success: true,
        message,
        organizationId: org.id,
        onboardingStatus: finalStatus,
        onboardingApproved: onboardingResult.onboardingApproved,
        ssmApproved,
        amlApproved: Boolean(amlResult?.amlApproved ?? org.aml_approved),
        advanced,
        onboardingProviderStatus: onboardingResult.onboardingProviderStatus,
        amlProviderStatus: null,
        lastSyncedAt: new Date().toISOString(),
        directorsUpdated: Math.max(onboardingResult.directorsUpdated, amlResult?.directorsUpdated ?? 0),
        refreshedSources,
        warnings,
        partialFailures,
      };
    }

    // PERSONAL / INDIVIDUAL onboarding.
    return this.refreshPersonalOnboardingStatus(onboarding, org, isInvestor, adminUserId);
  }

  /**
   * Personal/individual admin refresh: query the live individual onboarding detail,
   * apply the same monotonic transitions as the liveness webhook (reusing the exact
   * shared decision helpers/handler so behavior stays identical), then — if a KYC
   * record exists — apply the shared personal AML milestone from a live KYC query.
   */
  private async refreshPersonalOnboardingStatus(
    onboarding: { id: string; request_id: string; reference_id: string; portal_type: string },
    org: { id: string; name: string | null; onboarding_status: OnboardingStatus; onboarding_approved: boolean; aml_approved: boolean; kyc_id?: string | null },
    isInvestor: boolean,
    adminUserId: string
  ): Promise<{
    success: true;
    message: string;
    organizationId: string;
    onboardingStatus: OnboardingStatus;
    onboardingApproved: boolean;
    ssmApproved: boolean;
    amlApproved: boolean;
    advanced: boolean;
    onboardingProviderStatus: string | null;
    amlProviderStatus: string | null;
    lastSyncedAt: string | null;
    directorsUpdated: number;
    refreshedSources: string[];
    warnings: string[];
    partialFailures: string[];
  }> {
    const warnings: string[] = [];
    const partialFailures: string[] = [];
    const refreshedSources: string[] = [];
    const portalType = onboarding.portal_type as PortalType;

    let regtankDetails: Record<string, unknown> | null = null;
    try {
      regtankDetails = (await this.regTankApiClient.queryOnboardingDetails(onboarding.request_id)) as Record<string, unknown>;
      refreshedSources.push("INDIVIDUAL_ONBOARDING");
    } catch (error) {
      partialFailures.push("INDIVIDUAL_ONBOARDING");
      warnings.push(
        `Failed to query RegTank individual onboarding status: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const rawStatus = typeof regtankDetails?.status === "string" ? (regtankDetails.status as string) : null;
    const statusUpper = rawStatus?.toUpperCase() ?? null;

    if (rawStatus) {
      try {
        await this.regTankRepository.updateStatus(onboarding.request_id, {
          status: normalizeRawStatus(rawStatus),
          regtankResponse: regtankDetails as Prisma.InputJsonValue,
        });
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error), requestId: onboarding.request_id },
          "[Admin Refresh] Failed to persist refreshed individual onboarding status (non-blocking)"
        );
      }
    }

    const knownStatuses = new Set([
      "URL_GENERATED",
      "PROCESSING",
      "ID_UPLOADED_FAILED",
      "ID_UPLOADED",
      "LIVENESS_STARTED",
      "LIVENESS_FAILED",
      "CAMERA_FAILED",
      "EMAIL_SENT",
      "LIVENESS_PASSED",
      "WAIT_FOR_APPROVAL",
      "APPROVED",
      "REJECTED",
      "RESUBMISSION",
      "EXPIRED",
    ]);
    if (statusUpper && !knownStatuses.has(statusUpper)) {
      warnings.push(`Observed undocumented RegTank individual onboarding status: ${statusUpper}`);
    }

    if (statusUpper === "LIVENESS_PASSED" || statusUpper === "WAIT_FOR_APPROVAL") {
      const update = getIndividualWaitForApprovalUpdate({ currentOnboardingStatus: org.onboarding_status });
      if (update) {
        if (isInvestor) {
          await this.organizationRepository.updateInvestorOrganizationOnboarding(
            org.id,
            OnboardingStatus.PENDING_APPROVAL,
            { resetCompanySsmGateFromRegtankWebhook: true }
          );
        } else {
          await this.organizationRepository.updateIssuerOrganizationOnboarding(
            org.id,
            OnboardingStatus.PENDING_APPROVAL,
            { resetCompanySsmGateFromRegtankWebhook: true }
          );
        }
      }
    } else if (statusUpper === "APPROVED") {
      try {
        await this.regTankService.handleWebhookUpdate({
          requestId: onboarding.request_id,
          status: "APPROVED",
          referenceId: onboarding.reference_id,
        });
      } catch (error) {
        partialFailures.push("APPROVED_SYNC");
        warnings.push(
          `RegTank reports onboarding as approved, but applying the milestone failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else if (statusUpper === "REJECTED") {
      warnings.push("RegTank reports this onboarding as rejected. A REJECTED webhook may still be pending.");
    }

    const afterOnboarding = isInvestor
      ? await prisma.investorOrganization.findUnique({
          where: { id: org.id },
          select: { onboarding_status: true, onboarding_approved: true, aml_approved: true, kyc_id: true, name: true },
        })
      : await prisma.issuerOrganization.findUnique({
          where: { id: org.id },
          select: { onboarding_status: true, onboarding_approved: true, aml_approved: true, kyc_id: true, name: true },
        });

    let onboardingStatusResult = afterOnboarding?.onboarding_status ?? org.onboarding_status;
    let amlApprovedResult = Boolean(afterOnboarding?.aml_approved);
    let advanced = false;
    let amlProviderStatus: string | null = null;
    const kycId = afterOnboarding?.kyc_id ?? org.kyc_id ?? null;

    if (kycId) {
      try {
        const milestone = await applyPersonalAmlMilestoneFromLiveKyc({
          organizationId: org.id,
          portalType,
          userId: adminUserId,
          organizationName: afterOnboarding?.name ?? org.name,
          kycId,
          trigger: "ADMIN_MANUAL_ONBOARDING_REFRESH_PERSONAL",
          onboardingId: onboarding.id,
        });
        refreshedSources.push("KYC");
        amlProviderStatus = milestone.rawStatus;
        amlApprovedResult = milestone.amlApproved;
        advanced = milestone.advanced;
        onboardingStatusResult = milestone.onboardingStatus ?? onboardingStatusResult;
      } catch (error) {
        partialFailures.push("KYC");
        warnings.push(`Failed to query RegTank individual KYC status: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      warnings.push("No individual KYC record found yet; AML screening was not queried.");
    }

    let message: string;
    if (advanced) {
      message = "AML screening approved. Onboarding has advanced to Final Approval.";
    } else if (partialFailures.length > 0) {
      message = "Unable to retrieve the latest status from RegTank.";
    } else if (onboardingStatusResult === OnboardingStatus.PENDING_AML) {
      message = "RegTank screening status refreshed. AML approval is still pending.";
    } else if (onboardingStatusResult === OnboardingStatus.PENDING_APPROVAL) {
      message = "RegTank status refreshed. RegTank approval is still pending.";
    } else {
      message = "RegTank status refreshed.";
    }

    return {
      success: true,
      message,
      organizationId: org.id,
      onboardingStatus: onboardingStatusResult,
      onboardingApproved: Boolean(afterOnboarding?.onboarding_approved),
      ssmApproved: false,
      amlApproved: amlApprovedResult,
      advanced,
      onboardingProviderStatus: rawStatus,
      amlProviderStatus,
      lastSyncedAt: new Date().toISOString(),
      directorsUpdated: 0,
      refreshedSources,
      warnings,
      partialFailures,
    };
  }

  /**
   * List all financing applications with pagination and filters
   */
  async listApplications(params: GetAdminApplicationsQuery): Promise<{
    applications: {
      id: string;
      displayReference: string | null;
      issuerOrganizationName: string | null;
      financingTypeLabel: string;
      financingStructureLabel: string;
      requestedAmount: number;
      status: string;
      submittedAt: Date | null;
      updatedAt: Date;
      productId: string | null;
      baseProductId: string | null;
      directorShareholderAmlPending: boolean;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const repository = new AdminRepository();
    const { applications, total } = await repository.getApplications(params);

    const orgService = new OrganizationService();
    const orgIds = [
      ...new Set(
        applications
          .map((a) => a.issuerOrganizationId)
          .filter((x): x is string => typeof x === "string" && x.length > 0)
      ),
    ];
    const pendingByOrg = new Map<string, boolean>();
    await Promise.all(
      orgIds.map(async (oid) => {
        const org = await prisma.issuerOrganization.findUnique({
          where: { id: oid },
          select: { corporate_entities: true, director_kyc_status: true, director_aml_status: true },
        });
        if (!org) {
          pendingByOrg.set(oid, false);
          return;
        }
        const extras = await orgService.getIssuerPartyListExtras(oid);
        const people = buildAdminPeopleList({
          ctos: extras.latestOrganizationCtosCompanyJson ?? null,
          issuerDirectorKycStatus: org.director_kyc_status ?? null,
          issuerDirectorAmlStatus: org.director_aml_status ?? null,
          ctosPartySupplements: extras.ctosPartySupplements,
          corporateEntities: org.corporate_entities ?? null,
        });
        const pending = computeHasPendingDirectorShareholder(people);
        pendingByOrg.set(oid, pending);
      })
    );

    return {
      applications: applications.map(({ issuerOrganizationId, ...rest }) => {
        if (isFinalApplicationStatusForAmlGuard(rest.status)) {
          return {
            ...rest,
            directorShareholderAmlPending: false,
          };
        }
        return {
          ...rest,
          directorShareholderAmlPending: issuerOrganizationId
            ? pendingByOrg.get(issuerOrganizationId) ?? false
            : false,
        };
      }),
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  async getApplicationActionRequiredCount() {
    const [
      count,
      submitted,
      underReview,
      resubmitted,
      contractPending,
      contractAccepted,
      invoicePending,
    ] = await Promise.all([
      prisma.application.count({ where: { status: { in: [...APPLICATION_ACTION_REQUIRED_STATUSES] } } }),
      prisma.application.count({ where: { status: ApplicationStatus.SUBMITTED } }),
      prisma.application.count({ where: { status: ApplicationStatus.UNDER_REVIEW } }),
      prisma.application.count({ where: { status: ApplicationStatus.RESUBMITTED } }),
      prisma.application.count({ where: { status: ApplicationStatus.CONTRACT_PENDING } }),
      prisma.application.count({ where: { status: ApplicationStatus.CONTRACT_ACCEPTED } }),
      prisma.application.count({ where: { status: ApplicationStatus.INVOICE_PENDING } }),
    ]);

    const breakdown = {
      submitted,
      underReview,
      resubmitted,
      contractPending,
      contractAccepted,
      invoicePending,
    };

    return {
      count,
      breakdown,
    };
  }

  /**
   * List all contracts with pagination and filters
   */
  async listContracts(params: GetAdminContractsQuery): Promise<{
    contracts: {
      id: string;
      displayReference: string | null;
      contractNumber: string | null;
      title: string | null;
      issuerOrganizationName: string | null;
      contractValue: number;
      approvedFacility: number;
      utilizedFacility: number;
      status: string;
      updatedAt: Date;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const repository = new AdminRepository();
    const { contracts, total } = await repository.getContracts(params);

    return {
      contracts,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  async getContractDetail(id: string) {
    const repository = new AdminRepository();
    const contract = await repository.getContractById(id);
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Facility not found");
    }
    return contract;
  }

  /**
   * Expose RegTank screening fields stored on `metadata` at the top level for admin UI.
   */
  private mapApplicationGuarantorsForAdmin(guarantors: ApplicationGuarantor[] | undefined) {
    if (!guarantors?.length) return guarantors;
    return guarantors.map((ag) => {
      const meta = isPlainObjectRecord(ag.metadata) ? ag.metadata : {};
      const amlScreening = isPlainObjectRecord(meta.aml_screening) ? meta.aml_screening : null;
      return {
        ...ag,
        onboarding_request_id:
          typeof meta.onboarding_request_id === "string" ? meta.onboarding_request_id : undefined,
        regtank_portal_url:
          typeof meta.regtank_portal_url === "string" ? meta.regtank_portal_url : undefined,
        onboarding_verify_link:
          typeof meta.onboarding_verify_link === "string" ? meta.onboarding_verify_link : undefined,
        aml_screening: amlScreening,
      };
    });
  }

  /**
   * Start Acuris KYC (individual) or KYB (company) AML screening for an application guarantor
   * (RegTank `POST /v3/kyc/input` or `POST /v3/kyb/input`). Webhooks: `/kyc` and `/kyb`.
   */
  async startApplicationGuarantorAcurisScreening(
    applicationId: string,
    clientGuarantorId: string,
    adminUserId: string
  ): Promise<{ requestId: string; regtank_portal_url: string }> {
    const row = await prisma.applicationGuarantor.findFirst({
      where: {
        application_id: applicationId,
        client_guarantor_id: clientGuarantorId,
      },
    });
    if (!row) {
      throw new AppError(404, "NOT_FOUND", "Application guarantor not found");
    }

    const referenceId = row.client_guarantor_id.trim();
    if (!referenceId) {
      throw new AppError(400, "VALIDATION_ERROR", "Guarantor has no client reference id");
    }

    const config = getRegTankConfig();
    let screeningResponse: { requestId: string };

    if (row.guarantor_type === "individual") {
      const name = (row.name ?? "").trim();
      const governmentIdNumber = (row.ic_number ?? "").replace(/\D/g, "");
      const email = row.email.trim().toLowerCase();
      if (!name) {
        throw new AppError(400, "VALIDATION_ERROR", "Individual guarantor requires a name");
      }
      if (governmentIdNumber.length < 6) {
        throw new AppError(400, "VALIDATION_ERROR", "Individual guarantor requires a valid IC number");
      }
      if (!email) {
        throw new AppError(400, "VALIDATION_ERROR", "Guarantor requires an email");
      }
      const nationality = guarantorNationalityIso2FromSourceData(row.source_data);
      if (!nationality || !isRegtankIso3166Code(nationality)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Individual guarantor requires a valid nationality (ISO 3166) on file for AML screening"
        );
      }
      screeningResponse = await this.regTankApiClient.createKycScreeningInput({
        name,
        governmentIdNumber,
        email,
        referenceId,
        enableReScreening: false,
        nationality,
      });
    } else {
      const businessName = (row.business_name ?? "").trim();
      const businessIdNumber = (row.ssm_number ?? "").trim();
      const email = row.email.trim().toLowerCase();
      if (!businessName) {
        throw new AppError(400, "VALIDATION_ERROR", "Company guarantor requires a business name");
      }
      if (!businessIdNumber) {
        throw new AppError(400, "VALIDATION_ERROR", "Company guarantor requires an SSM number");
      }
      if (!email) {
        throw new AppError(400, "VALIDATION_ERROR", "Guarantor requires an email");
      }
      screeningResponse = await this.regTankApiClient.createKybScreeningInput({
        businessName,
        businessIdNumber,
        referenceId,
        email,
        enableReScreening: false,
      });
    }

    const requestId = screeningResponse.requestId?.trim();
    if (!requestId) {
      throw new AppError(502, "REGTANK_ERROR", "RegTank did not return a screening request id");
    }

    const regtankPortalUrl =
      row.guarantor_type === "company"
        ? `${config.adminPortalUrl}/app/screen-kyb/result/${encodeURIComponent(requestId)}`
        : `${config.adminPortalUrl}/app/screen-kyc/result/${encodeURIComponent(requestId)}`;

    const prevMeta = isPlainObjectRecord(row.metadata) ? row.metadata : {};
    await prisma.applicationGuarantor.update({
      where: { id: row.id },
      data: {
        last_triggered_at: new Date(),
        triggered_by_admin_user_id: adminUserId,
        aml_message_status: "PENDING",
        metadata: {
          ...prevMeta,
          onboarding_request_id: requestId,
          regtank_portal_url: regtankPortalUrl,
        } as Prisma.InputJsonValue,
      },
    });

    return { requestId, regtank_portal_url: regtankPortalUrl };
  }

  /**
   * Get financing application detail by ID
   */
  async getApplicationDetail(id: string) {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(id);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    const issuerOrgId = application.issuer_organization_id;
    const issuerOrg = application.issuer_organization;
    let issuerOrganizationPayload = issuerOrg;
    if (issuerOrgId && issuerOrg) {
      const orgService = new OrganizationService();
      const extras = await orgService.getIssuerPartyListExtras(issuerOrgId);
      issuerOrganizationPayload = {
        ...issuerOrg,
        latest_organization_ctos_company_json: extras.latestOrganizationCtosCompanyJson,
        latest_organization_ctos_financials_json: extras.latestOrganizationCtosFinancialsJson,
        latest_organization_ctos_report_id: extras.latestOrganizationCtosReportId,
        latest_organization_ctos_fetched_at: extras.latestOrganizationCtosFetchedAt,
        latest_organization_ctos_has_report_html: extras.latestOrganizationCtosHasReportHtml,
        latest_organization_ctos_subject_reports: extras.latestOrganizationCtosSubjectReports.map((r) => ({
          id: r.id,
          subject_ref: r.subject_ref,
          fetched_at: r.fetched_at,
          has_report_html: r.has_report_html,
        })),
        ctos_party_supplements: extras.ctosPartySupplements.map((s) => ({
          party_key: s.partyKey,
          onboarding_json: s.onboardingJson,
        })),
      } as typeof issuerOrg;
    }
    const applicationWithIssuerExtras =
      issuerOrganizationPayload !== issuerOrg
        ? { ...application, issuer_organization: issuerOrganizationPayload }
        : application;
    const processingFeePaid = Boolean(
      await prisma.gatewayPayment.findFirst({
        where: {
          application_id: id,
          purpose: "APPLICATION_PROCESSING_FEE",
          status: "COMPLETED",
        },
        select: { id: true },
      })
    );
    const sectionPolicy = await this.getReviewSectionPolicy(application);
    const structureType =
      application.financing_structure && typeof application.financing_structure === "object"
        ? ((application.financing_structure as Record<string, unknown>).structure_type as
            | string
            | undefined)
        : undefined;
    if (structureType === "existing_contract") {
      await this.ensureExistingContractAcceptanceReviewApproved(
        repository,
        id,
        application
      );
    } else {
      await this.ensureAcceptanceHubReviewApprovedIfOfferComplete(
        repository,
        id,
        application,
        sectionPolicy.productWorkflow,
        structureType
      );
    }
    const sectionOrder = getReviewSectionOrder(structureType);
    const orderedRequiredSections = sectionOrder.filter((section) =>
      sectionPolicy.requiredSections.has(section)
    );
    const orderedVisibleSections = sectionOrder.filter((section) =>
      sectionPolicy.visibleSections.has(section)
    );
    const issuerOrgForPeople: Record<string, unknown> | null = isPlainObjectRecord(
      applicationWithIssuerExtras.issuer_organization
    )
      ? (applicationWithIssuerExtras.issuer_organization as Record<string, unknown>)
      : null;
    const partyBuild = buildDirectorShareholderPeopleList({
      ctos: issuerOrgForPeople?.latest_organization_ctos_company_json ?? null,
      issuerDirectorKycStatus: issuerOrgForPeople?.director_kyc_status ?? null,
      issuerDirectorAmlStatus: issuerOrgForPeople?.director_aml_status ?? null,
      ctosPartySupplements: Array.isArray(issuerOrgForPeople?.ctos_party_supplements)
        ? issuerOrgForPeople.ctos_party_supplements
        : null,
      corporateEntities: issuerOrgForPeople?.corporate_entities ?? null,
    });

    let inheritedAcceptance: Awaited<
      ReturnType<typeof loadInheritedAcceptanceForExistingContract>
    > = null;
    if (
      structureType === "existing_contract" &&
      application.contract_id &&
      application.contract?.status === "APPROVED"
    ) {
      inheritedAcceptance = await loadInheritedAcceptanceForExistingContract(prisma, {
        contractId: application.contract_id,
        originatingApplicationId:
          (application.contract as { originating_application_id?: string | null })
            .originating_application_id ?? null,
      });
    }

    const contractWithDisplayReference = applicationWithIssuerExtras.contract
      ? {
          ...applicationWithIssuerExtras.contract,
          displayReference: applicationWithIssuerExtras.contract.display_reference ?? null,
          invoices: (applicationWithIssuerExtras.contract.invoices ?? []).map((invoice) => ({
            ...invoice,
            displayReference: invoice.display_reference ?? null,
          })),
        }
      : null;
    const invoicesWithDisplayReference = (applicationWithIssuerExtras.invoices ?? []).map((invoice) => ({
      ...invoice,
      displayReference: invoice.display_reference ?? null,
    }));
    const applicationWithDisplayReference = {
      ...applicationWithIssuerExtras,
      displayReference: applicationWithIssuerExtras.display_reference ?? null,
      contract: contractWithDisplayReference,
      invoices: invoicesWithDisplayReference,
    };

    return {
      ...applicationWithDisplayReference,
      processingFeePaid,
      people: partyBuild.people,
      directorShareholderListSource: partyBuild.listSource,
      ctosDirectorShareholderWarning: partyBuild.ctosDirectorShareholderWarning,
      linked_notes: await prisma.note.findMany({
        where: { source_application_id: id },
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          note_reference: true,
          title: true,
          status: true,
          source_contract_id: true,
          source_invoice_id: true,
        },
      }),
      application_guarantors: this.mapApplicationGuarantorsForAdmin(
        applicationWithIssuerExtras.application_guarantors
      ),
      required_review_sections: orderedRequiredSections,
      visible_review_sections: orderedVisibleSections,
      review_section_prerequisites: sectionPolicy.prerequisitesBySection,
      // Frozen at application.product_version — Acceptance/signing UI must not use live catalog.
      product_workflow: sectionPolicy.productWorkflow,
      inherited_acceptance: inheritedAcceptance,
    };
  }

  /**
   * Full JSON snapshots for before/after resubmit comparison (admin).
   * `nextReviewCycle` is the cycle after resubmit. Remarks come from ApplicationReviewRemark
   * for review cycle N-1 — never from ApplicationLog or ApplicationAuditLog.
   */
  async getResubmitComparisonSnapshots(applicationId: string, nextReviewCycle: number) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    const prevCycle = nextReviewCycle - 1;

    const [nextRev, prevRev, remarks] = await Promise.all([
      prisma.applicationRevision.findFirst({
        where: { application_id: applicationId, review_cycle: nextReviewCycle },
      }),
      prisma.applicationRevision.findFirst({
        where: { application_id: applicationId, review_cycle: prevCycle },
      }),
      prisma.applicationReviewRemark.findMany({
        where: {
          application_id: applicationId,
          review_cycle: prevCycle,
          action_type: "REQUEST_AMENDMENT",
          submitted_at: { not: null },
        },
        orderBy: { created_at: "asc" },
      }),
    ]);

    if (!nextRev) {
      throw new AppError(
        404,
        "NOT_FOUND",
        "Revision snapshot not found for this review cycle"
      );
    }
    if (!prevRev) {
      throw new AppError(404, "NOT_FOUND", "Previous revision snapshot not found");
    }

    logger.info(
      {
        applicationId,
        previous_review_cycle: prevCycle,
        next_review_cycle: nextReviewCycle,
      },
      "[admin] getResubmitComparisonSnapshots"
    );

    const amendment_remarks: ResubmitComparisonAmendmentRemark[] | undefined =
      remarks.length > 0
        ? remarks.map((row) => ({
            scope: row.scope,
            scope_key: row.scope_key,
            remark: row.remark,
            author_user_id: row.author_user_id,
            submitted_at: row.submitted_at ? row.submitted_at.toISOString() : null,
          }))
        : undefined;

    return {
      previous_review_cycle: prevCycle,
      next_review_cycle: nextReviewCycle,
      previous_snapshot: prevRev.snapshot as Prisma.JsonValue,
      next_snapshot: nextRev.snapshot as Prisma.JsonValue,
      previous_submitted_at: prevRev.submitted_at.toISOString(),
      next_submitted_at: nextRev.submitted_at.toISOString(),
      amendment_remarks,
    };
  }

  private async resolveSignedOfferLetterS3KeyFromEnvelope(params: {
    applicationId: string;
    contractId?: string | null;
    invoiceId?: string | null;
  }): Promise<string> {
    const envelope = await prisma.signingEnvelope.findFirst({
      where: {
        application_id: params.applicationId,
        status: "COMPLETED",
        ...(params.contractId ? { contract_id: params.contractId } : {}),
        ...(params.invoiceId ? { invoice_id: params.invoiceId } : {}),
      },
      include: {
        documents: {
          where: { source: "GENERATED_OFFER_LETTER" },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { completed_at: "desc" },
    });

    const signedDocument = envelope?.documents.find((document) => document.signed_s3_key?.trim());
    const key = signedDocument?.signed_s3_key?.trim();
    if (!key) {
      throw new AppError(400, "INVALID_STATE", "Signed offer letter is not available");
    }
    return key;
  }

  /**
   * Signed invoice offer letter PDF (admin). Does not require issuer org membership.
   */
  async getSignedInvoiceOfferLetterPdfForAdmin(applicationId: string, invoiceId: string) {
    const s3Key = await this.resolveSignedOfferLetterS3KeyFromEnvelope({
      applicationId,
      invoiceId,
    });
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, application_id: applicationId },
      select: { id: true },
    });
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found");
    }
    const buffer = await getS3ObjectBuffer(s3Key);
    return { buffer, filename: `signed-invoice-offer-${invoice.id}.pdf` };
  }

  /**
   * Signed contract offer letter PDF (admin). Does not require issuer org membership.
   */
  async getSignedContractOfferLetterPdfForAdmin(applicationId: string) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { contract_id: true },
    });
    if (!application?.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
    }
    const s3Key = await this.resolveSignedOfferLetterS3KeyFromEnvelope({
      applicationId,
      contractId: application.contract_id,
    });
    const buffer = await getS3ObjectBuffer(s3Key);
    return { buffer, filename: `signed-contract-offer-${application.contract_id}.pdf` };
  }

  /**
   * Update AR financing application status.
   * Restricts transitions to explicit admin review actions.
   */
  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    userId: string,
    logContext?: AdminLogContext
  ) {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(id);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    const currentStatus = application.status as ApplicationStatus;
    const allowedTargets = new Set<ApplicationStatus>([
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.REJECTED,
    ]);
    if (!allowedTargets.has(status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Unsupported admin status transition target: ${status}`
      );
    }

    if (status === ApplicationStatus.REJECTED) {
      const envelopes = await prisma.signingEnvelope.findMany({
        where: { application_id: id },
        select: { status: true },
      });
      const phase = this.resolveApplicationOriginationPhase({
        status: currentStatus,
        contract: application.contract,
        invoices: application.invoices,
        financing_structure: application.financing_structure,
        signing_envelopes: envelopes,
      });
      if (!canRejectApplication(phase)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Application cannot be rejected after a facility or invoice has been approved"
        );
      }
    }

    if (status === ApplicationStatus.UNDER_REVIEW) {
      if (currentStatus !== ApplicationStatus.AMENDMENT_REQUESTED) {
        const correctionGuidance =
          currentStatus === ApplicationStatus.COMPLETED || currentStatus === ApplicationStatus.REJECTED
            ? ` ${this.getCorrectionFlowGuidance()}`
            : "";
        throw new AppError(
          400,
          "INVALID_STATE",
          `Reset to UNDER_REVIEW is only allowed from AMENDMENT_REQUESTED.${correctionGuidance}`
        );
      }
    }

    let updatedApplication;
    if (status === ApplicationStatus.REJECTED) {
      const voidableEnvelopes = await prisma.signingEnvelope.findMany({
        where: {
          application_id: id,
          status: { in: [...VOIDABLE_ENVELOPE_STATUSES] },
        },
        select: { id: true },
      });
      const rejectAuditContext = adminApplicationAuditContext(userId, {
        ipAddress: logContext?.ipAddress,
        userAgent: logContext?.userAgent,
      });
      const voidFailures: string[] = [];
      for (const { id: envelopeId } of voidableEnvelopes) {
        try {
          await signingService.voidEnvelope(
            envelopeId,
            "Application rejected by admin",
            rejectAuditContext
          );
        } catch (voidError) {
          if (voidError instanceof AppError && voidError.code === "SIGNING_ENVELOPE_NOT_VOIDABLE") {
            continue;
          }
          voidFailures.push(envelopeId);
          logger.error(
            { error: voidError, applicationId: id, envelopeId },
            "Failed to void signing envelope during application rejection"
          );
        }
      }
      if (voidFailures.length > 0) {
        throw new AppError(
          502,
          "SIGNING_ENVELOPE_VOID_FAILED",
          `Failed to void signing package(s): ${voidFailures.join(", ")}. The application was not rejected.`
        );
      }
      await closeApplicationAsRejected(id, {
        context: rejectAuditContext,
        previousStatus: currentStatus,
      });
      updatedApplication = await repository.getApplicationById(id);
    } else {
      updatedApplication = await prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
          where: { id },
          data: { status },
          include: {
            issuer_organization: true,
          },
        });
        if (status === ApplicationStatus.UNDER_REVIEW) {
          await writeApplicationAuditLog(
            {
              eventType: "APPLICATION_REOPENED_FOR_REVIEW",
              context: adminApplicationAuditContext(userId, {
                ipAddress: logContext?.ipAddress,
                userAgent: logContext?.userAgent,
              }),
              applicationId: id,
              targetType: APPLICATION_AUDIT_TARGET_TYPE.APPLICATION,
              targetId: id,
              metadata: {
                previousStatus: currentStatus,
                newStatus: "UNDER_REVIEW",
              },
            },
            tx
          );
        }
        return updated;
      });
    }

    if (status === ApplicationStatus.REJECTED) {
      try {
        await this.sendIssuerNotification(
          id,
          NotificationTypeIds.APPLICATION_REJECTED,
          { applicationId: id },
          "rejected"
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId: id, status },
          "Failed to send issuer application status notification"
        );
      }
    }

    logger.info(
      { applicationId: id, newStatus: status },
      "AR financing application status updated by admin"
    );

    return updatedApplication;
  }

  private static readonly REVIEWABLE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.CONTRACT_PENDING,
    ApplicationStatus.CONTRACT_SENT,
    ApplicationStatus.CONTRACT_ACCEPTED,
    ApplicationStatus.INVOICE_ACCEPTED,
    ApplicationStatus.SIGNING_PENDING,
    ApplicationStatus.INVOICE_PENDING,
    ApplicationStatus.INVOICES_SENT,
    ApplicationStatus.OFFER_EXPIRED,
    ApplicationStatus.RESUBMITTED,
    ApplicationStatus.AMENDMENT_REQUESTED,
  ];

  private isReviewable(status: ApplicationStatus): boolean {
    return AdminService.REVIEWABLE_STATUSES.includes(status);
  }

  private getCorrectionFlowGuidance(): string {
    return "Terminal applications cannot be reopened through this action.";
  }

  private resolveApplicationOriginationPhase(application: {
    status: string;
    financing_structure?: unknown;
    contract?: { status?: string | null; offer_details?: unknown } | null;
    invoices?: Array<{
      status?: string | null;
      contract_id?: string | null;
      offer_details?: unknown;
    }>;
    signing_envelopes?: Array<{ status?: string | null }>;
  }) {
    return resolveOriginationPhase(
      buildOriginationPhaseInput({
        applicationStatus: application.status,
        contract: application.contract,
        invoices: application.invoices,
        offerAcceptanceStatus: extractPrimaryOfferAcceptanceStatus({
          financing_structure: application.financing_structure as {
            structure_type?: string;
          } | null,
          contract: application.contract,
          invoices: application.invoices,
        }),
        signingEnvelopes: application.signing_envelopes,
      })
    );
  }

  private async assertResetReviewToPendingAllowed(
    applicationId: string,
    section: ReviewSection,
    application: {
      status: string;
      financing_structure?: unknown;
      contract?: { status?: string | null } | null;
      invoices?: Array<{ status?: string | null }>;
    }
  ): Promise<void> {
    const envelopes = await prisma.signingEnvelope.findMany({
      where: { application_id: applicationId },
      select: { status: true },
    });
    const onlyDraft =
      envelopes.length === 0 || envelopes.every((envelope) => envelope.status === "DRAFT");
    const phase = this.resolveApplicationOriginationPhase({
      ...application,
      signing_envelopes: envelopes,
    });
    const isOfferRetract =
      (section === "contract_details" || section === "invoice_details") && phase === "offerLive";
    if (isOfferRetract) {
      return;
    }
    if (!canResetReviewToPending(phase, { signingEnvelopesOnlyDraft: onlyDraft })) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "Cannot reset this section in the current application phase"
      );
    }
  }

  private assertFinancialReviewDirectorShareholderAmlApproved(application: {
    issuer_organization?: {
      corporate_entities?: unknown;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
      latest_organization_ctos_company_json?: unknown;
      ctos_party_supplements?: { party_key: string; onboarding_json?: unknown }[];
    } | null;
  }): void {
    const issuerOrg = application.issuer_organization;
    if (!issuerOrg) return;

    const supplements = Array.isArray(issuerOrg.ctos_party_supplements)
      ? issuerOrg.ctos_party_supplements
      : [];
    const people = buildAdminPeopleList({
      ctos: issuerOrg.latest_organization_ctos_company_json ?? null,
      issuerDirectorKycStatus: issuerOrg.director_kyc_status ?? null,
      issuerDirectorAmlStatus: issuerOrg.director_aml_status ?? null,
      ctosPartySupplements: supplements.map((supplement) => ({
        party_key: supplement.party_key,
        onboarding_json: supplement.onboarding_json ?? null,
      })),
      corporateEntities: issuerOrg.corporate_entities ?? null,
    });
    if (computeHasPendingDirectorShareholder(people)) {
      throw new AppError(
        400,
        "DIRECTOR_SHAREHOLDER_NOT_READY",
        "Director/shareholder verification must be complete before this action."
      );
    }
  }

  /**
   * Transition application to UNDER_REVIEW on first review action (when SUBMITTED or RESUBMITTED)
   */
  private allInvoicesOfferableOrResolved(invoiceStatuses: string[]): boolean {
    if (invoiceStatuses.length === 0) return false;
    return invoiceStatuses.every((status) =>
      ["OFFER_SENT", "OFFER_EXPIRED", "APPROVED", "WITHDRAWN", "REJECTED"].includes(status)
    );
  }

  private isContractTabUnlocked(
    application: { application_reviews?: { section: string; status: string }[] },
    sectionPolicy: { visibleSections: Set<ReviewSection>; prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>> }
  ): boolean {
    const prereqs = sectionPolicy.prerequisitesBySection.contract_details;
    if (!prereqs?.length) return true;
    const relevantPrereqs = prereqs.filter((p) => sectionPolicy.visibleSections.has(p));
    if (!relevantPrereqs.length) return true;
    const reviews = (application.application_reviews ?? []) as { section: string; status: string }[];
    const sectionStatusMap = new Map(reviews.map((r) => [r.section, r.status]));
    return relevantPrereqs.every((prereq) => sectionStatusMap.get(prereq) === "APPROVED");
  }

  private isInvoiceTabUnlocked(
    application: { application_reviews?: { section: string; status: string }[] },
    sectionPolicy: { visibleSections: Set<ReviewSection>; prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>> }
  ): boolean {
    const prereqs = sectionPolicy.prerequisitesBySection.invoice_details;
    if (!prereqs?.length) return true;
    const relevantPrereqs = prereqs.filter((p) => sectionPolicy.visibleSections.has(p));
    if (!relevantPrereqs.length) return true;
    const reviews = (application.application_reviews ?? []) as { section: string; status: string }[];
    const sectionStatusMap = new Map(reviews.map((r) => [r.section, r.status]));
    return relevantPrereqs.every((prereq) => sectionStatusMap.get(prereq) === "APPROVED");
  }

  private resolveAdminStageStatus(input: {
    contractId?: string | null;
    contractStatus?: string | null;
    invoiceStatuses: string[];
    isContractTabUnlocked?: boolean;
    isInvoiceTabUnlocked?: boolean;
    isInvoiceOnly?: boolean;
    isExistingContract?: boolean;
    offerAcceptanceStatus?: OfferAcceptanceStatus | null;
  }): ApplicationStatus {
    const {
      contractId,
      contractStatus,
      invoiceStatuses,
      isContractTabUnlocked,
      isInvoiceTabUnlocked,
      isInvoiceOnly,
      isExistingContract,
      offerAcceptanceStatus,
    } = input;

    if (contractId && !isInvoiceOnly && isExistingContract) {
      return resolveInvoiceCentricApplicationStatus({
        invoiceStatuses,
        isInvoiceTabUnlocked: isInvoiceTabUnlocked ?? false,
        isInvoiceOnly: false,
      });
    }

    if (contractId && !isInvoiceOnly) {
      if (contractStatus === "OFFER_EXPIRED") {
        return ApplicationStatus.OFFER_EXPIRED;
      }
      if (contractStatus === "OFFER_SENT") {
        const phaseStatus = resolveApplicationStatusFromOfferAcceptancePhase(
          false,
          offerAcceptanceStatus ?? null
        );
        if (phaseStatus && phaseStatus !== ApplicationStatus.CONTRACT_SENT) {
          return phaseStatus;
        }
        return ApplicationStatus.CONTRACT_SENT;
      }
      if (contractStatus === "APPROVED") {
        if (invoiceStatuses.length === 0) return ApplicationStatus.COMPLETED;
        if (this.allInvoicesOfferableOrResolved(invoiceStatuses)) {
          if (
            invoiceStatuses.some((status) => status === "OFFER_EXPIRED") &&
            !invoiceStatuses.some((status) => status === "OFFER_SENT")
          ) {
            return ApplicationStatus.OFFER_EXPIRED;
          }
          return ApplicationStatus.INVOICES_SENT;
        }
        if (!isInvoiceTabUnlocked) return ApplicationStatus.UNDER_REVIEW;
        return ApplicationStatus.INVOICE_PENDING;
      }
      if (isContractTabUnlocked) return ApplicationStatus.CONTRACT_PENDING;
      return ApplicationStatus.UNDER_REVIEW;
    }

    return resolveInvoiceCentricApplicationStatus({
      invoiceStatuses,
      isInvoiceTabUnlocked: isInvoiceTabUnlocked ?? false,
      isInvoiceOnly: isInvoiceOnly ?? false,
      offerAcceptanceStatus,
      entityApproved: invoiceStatuses.some((status) => status === "APPROVED"),
    });
  }

  /**
   * Statuses where admin review can still move the app between stage badges
   * (e.g. UNDER_REVIEW → CONTRACT_PENDING when the contract tab unlocks).
   * Offer-phase statuses (CONTRACT_SENT, SIGNING_PENDING, …) are owned by offer/signing flows.
   */
  private static readonly STAGE_SYNC_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.RESUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.CONTRACT_PENDING,
    ApplicationStatus.INVOICE_PENDING,
  ]);

  private shouldSyncAdminStageStatus(
    appStatus: ApplicationStatus,
    isExistingContract: boolean
  ): boolean {
    if (AdminService.STAGE_SYNC_STATUSES.has(appStatus)) return true;
    return (
      isExistingContract &&
      (CONTRACT_OFFER_CEREMONY_APPLICATION_STATUSES as ApplicationStatus[]).includes(appStatus)
    );
  }

  /**
   * Recompute application.status from contract/invoice state + tab unlock.
   * Call after section/item approvals so CONTRACT_PENDING / INVOICE_PENDING stick when tabs unlock.
   */
  private async syncAdminStageStatus(
    repository: AdminRepository,
    applicationId: string,
    application: {
      status?: string;
      contract_id?: string | null;
      contract?: { status?: string; offer_details?: unknown } | null;
      invoices?: Array<{ status?: string; contract_id?: string | null; offer_details?: unknown }>;
      application_reviews?: { section: string; status: string }[];
      financing_type?: unknown;
      financing_structure?: unknown;
    },
    reviewerUserId?: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const appStatus = (application.status as ApplicationStatus) ?? ApplicationStatus.UNDER_REVIEW;
    const structure = application.financing_structure as { structure_type?: string } | null | undefined;
    const isExistingContract = isExistingContractFinancing(structure);
    if (!this.shouldSyncAdminStageStatus(appStatus, isExistingContract)) {
      return;
    }

    if (isExistingContract) {
      await this.ensureExistingContractAcceptanceReviewApproved(
        repository,
        applicationId,
        application
      );
    }

    const isInvoiceOnly = structure?.structure_type === "invoice_only";
    const sectionPolicy = await this.getReviewSectionPolicy(application);
    const isContractTabUnlocked =
      application.contract_id != null
        ? this.isContractTabUnlocked(application, sectionPolicy)
        : false;
    const isInvoiceTabUnlocked = this.isInvoiceTabUnlocked(application, sectionPolicy);
    const offerAcceptanceStatus = extractPrimaryOfferAcceptanceStatus({
      financing_structure: structure ?? undefined,
      contract: application.contract ?? undefined,
      invoices: application.invoices,
    });
    const targetStatus = this.resolveAdminStageStatus({
      contractId: application.contract_id,
      contractStatus: application.contract?.status ?? null,
      invoiceStatuses: (application.invoices ?? []).map(
        (inv) => (inv as { status?: string }).status ?? "DRAFT"
      ),
      isContractTabUnlocked,
      isInvoiceTabUnlocked,
      isInvoiceOnly,
      isExistingContract,
      offerAcceptanceStatus,
    });
    if (targetStatus !== appStatus) {
      const startedReview =
        (appStatus === ApplicationStatus.SUBMITTED ||
          appStatus === ApplicationStatus.RESUBMITTED) &&
        targetStatus === ApplicationStatus.UNDER_REVIEW;

      if (startedReview && reviewerUserId) {
        await prisma.$transaction(async (tx) => {
          await tx.application.update({
            where: { id: applicationId },
            data: { status: targetStatus },
          });
          await writeApplicationAuditLog(
            {
              eventType: "APPLICATION_REVIEW_STARTED",
              context: adminApplicationAuditContext(reviewerUserId, {
                ipAddress: logContext?.ipAddress,
                userAgent: logContext?.userAgent,
              }),
              applicationId,
              targetType: APPLICATION_AUDIT_TARGET_TYPE.APPLICATION,
              targetId: applicationId,
              metadata: {
                previousStatus: appStatus,
                newStatus: "UNDER_REVIEW",
              },
            },
            tx
          );
        });
      } else {
        await repository.updateApplicationStatus(applicationId, targetStatus);
      }
    }
  }

  private async ensureUnderReview(
    repository: AdminRepository,
    applicationId: string,
    appStatus: ApplicationStatus,
    application: {
      status?: string;
      contract_id?: string | null;
      contract?: { status?: string; offer_details?: unknown } | null;
      invoices?: Array<{ status?: string; contract_id?: string | null; offer_details?: unknown }>;
      application_reviews?: { section: string; status: string }[];
      financing_type?: unknown;
      financing_structure?: unknown;
    },
    reviewerUserId?: string,
    logContext?: AdminLogContext
  ) {
    await this.syncAdminStageStatus(
      repository,
      applicationId,
      {
        ...application,
        status: application.status ?? appStatus,
      },
      reviewerUserId,
      logContext
    );
  }

  /**
   * Existing-contract apps inherit contract acceptance from the prior application.
   * Mark acceptance_documents APPROVED when a stale PENDING row exists from older flows.
   */
  private async ensureExistingContractAcceptanceReviewApproved(
    repository: AdminRepository,
    applicationId: string,
    application: {
      contract?: { status?: string } | null;
      application_reviews?: { section: string; status: string }[];
    }
  ): Promise<void> {
    if (application.contract?.status !== "APPROVED") {
      return;
    }
    const existing = application.application_reviews?.find(
      (review) => review.section === "acceptance_documents"
    );
    if (existing?.status === "APPROVED") {
      return;
    }
    await repository.ensureApplicationReviewSection(applicationId, "acceptance_documents");
    await prisma.applicationReview.update({
      where: {
        application_id_section: {
          application_id: applicationId,
          section: "acceptance_documents",
        },
      },
      data: {
        status: ReviewStepStatus.APPROVED,
        reviewer_user_id: null,
        reviewed_at: new Date(),
      },
    });
  }

  /**
   * Signing-only products never create an acceptance_documents review row during
   * doc review. Once the primary offer is accepted, mark the tab APPROVED so the
   * admin status dot matches the completed signing package.
   */
  private async ensureAcceptanceHubReviewApprovedIfOfferComplete(
    repository: AdminRepository,
    applicationId: string,
    application: {
      contract?: { status?: string } | null;
      invoices?: Array<{ contract_id?: string | null; status?: string }>;
      application_reviews?: { section: string; status: string }[];
    },
    workflow: unknown,
    structureType?: string | null
  ): Promise<void> {
    if (
      !isAcceptanceHubCompleteFromOffer({
        workflow,
        structureType,
        contractStatus: application.contract?.status ?? null,
        invoices: application.invoices,
      })
    ) {
      return;
    }
    const existing = application.application_reviews?.find(
      (review) => review.section === "acceptance_documents"
    );
    if (existing?.status === "APPROVED") {
      return;
    }
    await repository.ensureApplicationReviewSection(applicationId, "acceptance_documents");
    await prisma.applicationReview.update({
      where: {
        application_id_section: {
          application_id: applicationId,
          section: "acceptance_documents",
        },
      },
      data: {
        status: ReviewStepStatus.APPROVED,
        reviewer_user_id: null,
        reviewed_at: new Date(),
      },
    });
    const reviews = application.application_reviews ?? [];
    const index = reviews.findIndex((review) => review.section === "acceptance_documents");
    if (index >= 0) {
      reviews[index] = { ...reviews[index], status: "APPROVED" };
    } else {
      reviews.push({ section: "acceptance_documents", status: "APPROVED" });
    }
    application.application_reviews = reviews;
  }

  /**
   * Resolve scope_key (e.g. invoice_details:0:INV-001) to the actual invoice database id.
   * Returns null if invalid.
   */
  private resolveInvoiceIdFromScopeKey(
    application: { invoices?: { id: string; details?: unknown }[] },
    itemId: string
  ): string | null {
    if (!itemId.startsWith("invoice_details:")) return null;
    const parts = itemId.split(":");
    if (parts.length < 3) return null;
    const idx = parseInt(parts[1], 10);
    if (!Number.isFinite(idx) || idx < 0) return null;
    const invoices = application.invoices ?? [];
    if (idx >= invoices.length) return null;
    const inv = invoices[idx];
    const details =
      inv?.details && typeof inv.details === "object"
        ? (inv.details as Record<string, unknown>)
        : null;
    const expectedNum = String(details?.number ?? idx + 1).replace(/:/g, "_");
    const keyNum = parts.slice(2).join(":").replace(/:/g, "_");
    if (expectedNum !== keyNum) return null;
    return inv?.id ?? null;
  }

  /**
   * Validate that an invoice item exists in the application.
   * Expects format invoice_details:<index>:<invoice_number>
   */
  private validateInvoiceExists(
    application: { invoices?: { id: string; details?: unknown }[] },
    itemId: string
  ): void {
    if (!this.resolveInvoiceIdFromScopeKey(application, itemId)) {
      throw new AppError(400, "INVALID_ITEM", `Invoice ${itemId} not found in this application`);
    }
  }

  /**
   * Validate that a document item exists in the application.
   * Expects format supporting_documents:<category>:<index>:<name>
   */
  private validateDocumentExists(
    application: { supporting_documents?: unknown; acceptance_documents?: unknown },
    itemId: string
  ): void {
    if (itemId.startsWith("acceptance_documents:")) {
      const docs = application.acceptance_documents;
      if (!docs || typeof docs !== "object") {
        throw new AppError(400, "INVALID_ITEM", "Application has no acceptance documents");
      }
      const docKeys = this.collectAcceptanceDocumentKeys(docs);
      if (!docKeys.has(itemId)) {
        throw new AppError(400, "INVALID_ITEM", `Document ${itemId} not found in this application`);
      }
      return;
    }
    const docs = application.supporting_documents;
    if (!docs || typeof docs !== "object") {
      throw new AppError(400, "INVALID_ITEM", "Application has no supporting documents");
    }
    if (!itemId.startsWith("supporting_documents:")) {
      throw new AppError(400, "INVALID_ITEM", `Invalid document item ID: ${itemId}`);
    }
    const docKeys = this.collectDocumentKeys(docs);
    if (!docKeys.has(itemId)) {
      throw new AppError(400, "INVALID_ITEM", `Document ${itemId} not found in this application`);
    }
  }

  private collectAcceptanceDocumentKeys(docs: unknown): Set<string> {
    const keys = new Set<string>();
    const root = docs as Record<string, unknown> | null;
    const list = Array.isArray(root?.documents)
      ? (root!.documents as unknown[])
      : Array.isArray(docs)
        ? (docs as unknown[])
        : [];
    list.forEach((d, i) => {
      const record = d as Record<string, unknown>;
      const name = String(record?.name ?? record?.title ?? "document");
      const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
      const idx =
        typeof record?.workflow_document_index === "number"
          ? record.workflow_document_index
          : i;
      keys.add(`acceptance_documents:${idx}:${slug}`);
    });
    return keys;
  }

  /** Collect document keys from supporting_documents structure (matches frontend document-list). */
  private collectDocumentKeys(docs: unknown): Set<string> {
    const keys = new Set<string>();
    const raw = (docs as Record<string, unknown>)?.supporting_documents ?? docs;
    if (Array.isArray(raw)) {
      raw.forEach((d: Record<string, unknown>, i: number) => {
        const name = String(d?.name ?? d?.title ?? "document");
        const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
        keys.add(`supporting_documents:others:${i}:${slug}`);
      });
      return keys;
    }
    if (typeof raw !== "object" || raw === null) return keys;
    const obj = raw as Record<string, unknown>;
    const categoryKeys = ["financial_docs", "legal_docs", "compliance_docs", "others"];
    for (const catKey of categoryKeys) {
      const val = obj[catKey];
      if (val == null) continue;
      const arr = Array.isArray(val) ? val : [val];
      arr.forEach((d: Record<string, unknown>, i: number) => {
        const name = String(d?.name ?? d?.title ?? "doc");
        const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
        keys.add(`supporting_documents:${catKey}:${i}:${slug}`);
      });
    }
    const cats = obj.categories;
    const labelToKey: Record<string, string> = {
      "Financial Docs": "financial_docs",
      "Legal Docs": "legal_docs",
      "Compliance Docs": "compliance_docs",
      Others: "others",
    };
    if (Array.isArray(cats)) {
      cats.forEach((cat: Record<string, unknown>, catIndex: number) => {
        const categoryLabel = String(cat?.name ?? `Category ${catIndex + 1}`);
        const categoryKey = labelToKey[categoryLabel] ?? `cat_${catIndex}`;
        const docList = Array.isArray(cat?.documents) ? cat.documents : [];
        docList.forEach((d: Record<string, unknown>, docIndex: number) => {
          const files = Array.isArray(d?.files) ? (d.files as Array<{ file_name?: string }>) : [];
          const file = (d?.file as { file_name?: string } | undefined) ?? files[0];
          const label =
            String(d?.title ?? file?.file_name ?? d?.name ?? "").trim() || `Document ${docIndex + 1}`;
          const slug = label.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
          keys.add(`supporting_documents:${categoryKey}:${docIndex}:${slug}`);
        });
      });
    }
    return keys;
  }

  /**
   * Validate that a review item exists in the application
   */
  private validateReviewItemExists(
    application: { invoices?: { id: string }[]; supporting_documents?: unknown },
    itemType: "invoice" | "document",
    itemId: string
  ): void {
    if (itemType === "invoice") {
      this.validateInvoiceExists(application as { invoices: { id: string }[] }, itemId);
    } else {
      this.validateDocumentExists(application as { supporting_documents?: unknown }, itemId);
    }
  }

  /**
   * Updates supporting_documents section row from document item rows and logs SECTION_* when it changes.
   */
  private async syncSupportingDocumentsSectionFromItems(
    repository: AdminRepository,
    applicationId: string,
    application: {
      supporting_documents?: unknown;
      application_reviews?: { section: string; status: string }[];
      application_review_items?: { item_type: string; item_id: string; status: string }[];
    },
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const docs = application.supporting_documents;
    if (!docs || typeof docs !== "object") {
      return;
    }
    const docKeys = [...this.collectDocumentKeys(docs)];
    if (docKeys.length === 0) {
      return;
    }

    const documentRows =
      application.application_review_items?.filter((r) => r.item_type === "document") ?? [];
    const target = computeSupportingDocumentsSectionStatus(
      docKeys,
      documentRows.map((r) => ({ item_id: r.item_id, status: r.status }))
    );

    const existing = application.application_reviews?.find((r) => r.section === "supporting_documents");
    const current = existing?.status ?? "PENDING";

    if (target === current) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await repository.ensureApplicationReviewSection(
        applicationId,
        "supporting_documents",
        tx
      );
      await repository.updateSectionReviewStatus(
        applicationId,
        "supporting_documents",
        target,
        reviewerUserId,
        tx
      );
      await this.logReviewActivity(
        applicationId,
        "section",
        "supporting_documents",
        current,
        target,
        reviewerUserId,
        null,
        logContext,
        tx
      );
    });

    if (target === "APPROVED") {
      await repository.removeDraftAmendment(applicationId, "section", "supporting_documents");
    }
  }

  /**
   * Updates acceptance_documents section row from per-document item rows (same rules as Documents).
   * When a primary offer_acceptance ceremony is in progress, do not finalize the section to
   * APPROVED until signing / offer accept sets offer_acceptance to COMPLETED.
   */
  private async syncAcceptanceDocumentsSectionFromItems(
    repository: AdminRepository,
    applicationId: string,
    application: {
      acceptance_documents?: unknown;
      application_reviews?: { section: string; status: string }[];
      application_review_items?: { item_type: string; item_id: string; status: string }[];
      contract?: { offer_details?: unknown } | null;
      invoices?: Array<{ contract_id?: string | null; offer_details?: unknown }>;
    },
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const docs = application.acceptance_documents;
    if (!docs || typeof docs !== "object") {
      return;
    }
    const docKeys = [...this.collectAcceptanceDocumentKeys(docs)];
    if (docKeys.length === 0) {
      return;
    }

    const documentRows =
      application.application_review_items?.filter((r) => r.item_type === "document") ?? [];
    let target = computeSupportingDocumentsSectionStatus(
      docKeys,
      documentRows.map((r) => ({ item_id: r.item_id, status: r.status }))
    );

    const primaryAcceptance =
      getOfferAcceptanceFromOfferDetails(application.contract?.offer_details) ??
      (application.invoices ?? [])
        .filter((inv) => !inv.contract_id)
        .map((inv) => getOfferAcceptanceFromOfferDetails(inv.offer_details))
        .find((phase) => phase != null) ??
      null;

    if (
      target === "APPROVED" &&
      primaryAcceptance != null &&
      primaryAcceptance.status !== "COMPLETED"
    ) {
      target = "PENDING";
    }

    const existing = application.application_reviews?.find((r) => r.section === "acceptance_documents");
    const current = existing?.status ?? "PENDING";

    if (target === current) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await repository.ensureApplicationReviewSection(
        applicationId,
        "acceptance_documents",
        tx
      );
      await repository.updateSectionReviewStatus(
        applicationId,
        "acceptance_documents",
        target,
        reviewerUserId,
        tx
      );
      await this.logReviewActivity(
        applicationId,
        "section",
        "acceptance_documents",
        current,
        target,
        reviewerUserId,
        null,
        logContext,
        tx
      );
    });

    if (target === "APPROVED") {
      await repository.removeDraftAmendment(applicationId, "section", "acceptance_documents");
    }
  }

  /** Derive Documents + Acceptance section rows after a document item review change. */
  private async syncDocumentDerivedSectionsFromItems(
    repository: AdminRepository,
    applicationId: string,
    application: {
      supporting_documents?: unknown;
      acceptance_documents?: unknown;
      application_reviews?: { section: string; status: string }[];
      application_review_items?: { item_type: string; item_id: string; status: string }[];
    },
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    await this.syncSupportingDocumentsSectionFromItems(
      repository,
      applicationId,
      application,
      reviewerUserId,
      logContext
    );
    const afterSupporting = await repository.getApplicationById(applicationId);
    await this.syncAcceptanceDocumentsSectionFromItems(
      repository,
      applicationId,
      (afterSupporting ?? application) as {
        acceptance_documents?: unknown;
        application_reviews?: { section: string; status: string }[];
        application_review_items?: { item_type: string; item_id: string; status: string }[];
        contract?: { offer_details?: unknown } | null;
        invoices?: Array<{ contract_id?: string | null; offer_details?: unknown }>;
      },
      reviewerUserId,
      logContext
    );
  }

  private async loadApplicationProductWorkflow(application: {
    financing_type?: unknown;
    product_version?: number | null;
  }): Promise<unknown[]> {
    const productId = (application.financing_type as { product_id?: string } | null | undefined)
      ?.product_id;
    if (!productId) return [];
    const productRepo = new ProductRepository();
    const product =
      application.product_version != null
        ? await productRepo.findByBaseAndVersion(productId, application.product_version)
        : await productRepo.findById(productId);
    return (product?.workflow as unknown[]) ?? [];
  }

  /** Primary offer (contract, else standalone invoice) acceptance phase status. */
  private getPrimaryOfferAcceptanceStatus(application: {
    financing_structure?: unknown;
    contract?: { offer_details?: unknown } | null;
    invoices?: Array<{ contract_id?: string | null; offer_details?: unknown }>;
  }): string | null {
    return this.getPrimaryOfferAcceptance(application)?.status ?? null;
  }

  private getPrimaryOfferAcceptanceSubmittedAt(application: {
    financing_structure?: unknown;
    contract?: { offer_details?: unknown } | null;
    invoices?: Array<{ contract_id?: string | null; offer_details?: unknown }>;
  }): string | null {
    const submittedAt = this.getPrimaryOfferAcceptance(application)?.submitted_at;
    return typeof submittedAt === "string" && submittedAt.trim() !== "" ? submittedAt : null;
  }

  private getPrimaryOfferAcceptance(application: {
    financing_structure?: unknown;
    contract?: { offer_details?: unknown } | null;
    invoices?: Array<{ contract_id?: string | null; offer_details?: unknown }>;
  }) {
    // Skip stale contract ceremony on existing_contract (same as extractPrimaryOfferAcceptanceStatus).
    if (isExistingContractFinancing(application.financing_structure)) {
      return null;
    }
    return (
      getOfferAcceptanceFromOfferDetails(application.contract?.offer_details) ??
      (application.invoices ?? [])
        .filter((inv) => !inv.contract_id)
        .map((inv) => getOfferAcceptanceFromOfferDetails(inv.offer_details))
        .find((phase) => phase != null) ??
      null
    );
  }

  /**
   * Keep offer_acceptance.status aligned with acceptance-doc review items.
   * - Amendment → CHANGES_REQUESTED (only after Step 1 was submitted); restamps acceptance clock
   * - Clearing all amendment flags rolls CHANGES_REQUESTED → PENDING_ADMIN_REVIEW
   * - All approved → APPROVED_FOR_SIGNING (only from PENDING_ADMIN_REVIEW / already approved)
   * - Never promote PENDING_ISSUER; never approve from CHANGES_REQUESTED without resubmit
   * - Reset of approvals rolls APPROVED_FOR_SIGNING → PENDING_ADMIN_REVIEW
   */
  private async syncOfferAcceptancePhaseFromAcceptanceDocs(
    applicationId: string,
    application: {
      financing_type?: unknown;
      product_version?: number | null;
      supporting_documents?: unknown;
      acceptance_documents?: unknown;
      contract?: {
        id: string;
        status: string;
        offer_details?: unknown;
      } | null;
      invoices?: Array<{
        id: string;
        status: string;
        contract_id?: string | null;
        offer_details?: unknown;
      }>;
      application_review_items?: Array<{ item_type: string; item_id: string; status: string }>;
    },
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const workflow = await this.loadApplicationProductWorkflow(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) return;

    const refreshed = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        financing_type: true,
        product_version: true,
        acceptance_documents: true,
        contract: {
          select: {
            id: true,
            status: true,
            withdraw_reason: true,
            offer_details: true,
          },
        },
        invoices: {
          select: {
            id: true,
            status: true,
            contract_id: true,
            withdraw_reason: true,
            offer_details: true,
          },
        },
        application_review_items: {
          select: { item_type: true, item_id: true, status: true },
        },
      },
    });
    if (refreshed) {
      application = {
        ...application,
        ...refreshed,
        contract: refreshed.contract ?? application.contract ?? null,
        invoices: refreshed.invoices ?? application.invoices,
        application_review_items:
          refreshed.application_review_items ?? application.application_review_items,
      };
    }

    const docKeys = collectAcceptanceDocumentReviewKeys(
      workflow,
      application.acceptance_documents
    );
    const documentRows =
      application.application_review_items?.filter((r) => r.item_type === "document") ?? [];
    const statusByKey = new Map(documentRows.map((r) => [r.item_id, r.status]));

    const hasAmendment = docKeys.some((key) => statusByKey.get(key) === "AMENDMENT_REQUESTED");
    const allApproved =
      docKeys.length > 0 && docKeys.every((key) => statusByKey.get(key) === "APPROVED");

    const now = new Date().toISOString();

    const resolveTargetStatus = (
      current: { status: string; submitted_at?: string | null } | null | undefined
    ): "CHANGES_REQUESTED" | "APPROVED_FOR_SIGNING" | "PENDING_ADMIN_REVIEW" | null => {
      if (!current) return null;
      if (
        current.status === "PENDING_ISSUER" ||
        current.status === "REJECTED" ||
        current.status === "DECLINED" ||
        current.status === "COMPLETED" ||
        current.status === "SIGNING_IN_PROGRESS"
      ) {
        return null;
      }
      // Issuer has not submitted Step 1 yet (no submitted_at on a fresh phase).
      if (!current.submitted_at && current.status !== "APPROVED_FOR_SIGNING") {
        return null;
      }

      if (hasAmendment) {
        if (
          current.status === "PENDING_ADMIN_REVIEW" ||
          current.status === "APPROVED_FOR_SIGNING" ||
          current.status === "CHANGES_REQUESTED"
        ) {
          return "CHANGES_REQUESTED";
        }
        return null;
      }

      // Admin cleared every change request (Set to Pending) — leave issuer-action phase.
      if (current.status === "CHANGES_REQUESTED") {
        return "PENDING_ADMIN_REVIEW";
      }

      if (allApproved) {
        // Require resubmit after changes: do not approve while still CHANGES_REQUESTED.
        if (
          current.status === "PENDING_ADMIN_REVIEW" ||
          current.status === "APPROVED_FOR_SIGNING"
        ) {
          return "APPROVED_FOR_SIGNING";
        }
        return null;
      }

      if (current.status === "APPROVED_FOR_SIGNING" && docKeys.length > 0) {
        return "PENDING_ADMIN_REVIEW";
      }
      return null;
    };

    const contract = application.contract;
    if (contract && contract.status === "OFFER_SENT" && contract.offer_details) {
      const offer = (contract.offer_details as Record<string, unknown>) ?? {};
      const current = getOfferAcceptanceFromOfferDetails(offer);
      const target = resolveTargetStatus(current);
      if (current && target && current.status !== target) {
        const updated = patchOfferAcceptance(offer, {
          status: target,
          reviewed_at: now,
          reviewed_by_user_id: reviewerUserId,
          ...(target === "APPROVED_FOR_SIGNING"
            ? signingDeadlinePatchOnApprove(workflow, now, current)
            : {}),
          ...(target === "CHANGES_REQUESTED"
            ? acceptanceDeadlinePatchOnChangesRequested(workflow, now, current)
            : {}),
        });
        await prisma.$transaction(async (tx) => {
          await tx.contract.update({
            where: { id: contract.id },
            data: { offer_details: updated as Prisma.InputJsonValue },
          });
          if (target === "APPROVED_FOR_SIGNING" || target === "CHANGES_REQUESTED") {
            await writeApplicationAuditLog(
              {
                eventType:
                  target === "APPROVED_FOR_SIGNING"
                    ? "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING"
                    : "CONTRACT_ACCEPTANCE_CHANGES_REQUESTED",
                context: adminApplicationAuditContext(reviewerUserId, {
                  ipAddress: logContext?.ipAddress,
                  userAgent: logContext?.userAgent,
                }),
                applicationId,
                targetType: APPLICATION_AUDIT_TARGET_TYPE.CONTRACT,
                targetId: contract.id,
                metadata: {
                  previousStatus: current.status,
                  newStatus: target,
                },
              },
              tx
            );
          }
        });
      }
    }

    for (const invoice of application.invoices ?? []) {
      if (invoice.contract_id) continue;
      if (invoice.status !== "OFFER_SENT" || !invoice.offer_details) continue;
      const offer = (invoice.offer_details as Record<string, unknown>) ?? {};
      const current = getOfferAcceptanceFromOfferDetails(offer);
      const target = resolveTargetStatus(current);
      if (!current || !target || current.status === target) {
        continue;
      }
      const updated = patchOfferAcceptance(offer, {
        status: target,
        reviewed_at: now,
        reviewed_by_user_id: reviewerUserId,
        ...(target === "APPROVED_FOR_SIGNING"
          ? signingDeadlinePatchOnApprove(workflow, now, current)
          : {}),
        ...(target === "CHANGES_REQUESTED"
          ? acceptanceDeadlinePatchOnChangesRequested(workflow, now, current)
          : {}),
      });
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { offer_details: updated as Prisma.InputJsonValue },
        });
        if (target === "APPROVED_FOR_SIGNING" || target === "CHANGES_REQUESTED") {
          await writeApplicationAuditLog(
            {
              eventType:
                target === "APPROVED_FOR_SIGNING"
                  ? "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING"
                  : "INVOICE_ACCEPTANCE_CHANGES_REQUESTED",
              context: adminApplicationAuditContext(reviewerUserId, {
                ipAddress: logContext?.ipAddress,
                userAgent: logContext?.userAgent,
              }),
              applicationId,
              targetType: APPLICATION_AUDIT_TARGET_TYPE.INVOICE,
              targetId: invoice.id,
              metadata: {
                previousStatus: current.status,
                newStatus: target,
              },
            },
            tx
          );
        }
      });
    }

    await this.persistApplicationStatusFromOfferPhase(applicationId);
  }

  private async persistApplicationStatusFromOfferPhase(applicationId: string): Promise<void> {
    const refreshed = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        financing_structure: true,
        contract: { select: { status: true, offer_details: true } },
        invoices: {
          select: { status: true, contract_id: true, offer_details: true },
        },
      },
    });
    if (!refreshed) return;

    const structure = refreshed.financing_structure as
      | { structure_type?: string }
      | null
      | undefined;
    const isInvoiceOnly = structure?.structure_type === "invoice_only";
    const offerAcceptanceStatus = extractPrimaryOfferAcceptanceStatus({
      financing_structure: structure ?? undefined,
      contract: refreshed.contract ?? undefined,
      invoices: refreshed.invoices,
    });
    const entityApproved =
      (!isInvoiceOnly && refreshed.contract?.status === "APPROVED") ||
      (isInvoiceOnly &&
        refreshed.invoices.some(
          (inv) => !inv.contract_id && inv.status === "APPROVED"
        ));
    const resolved = resolveApplicationStatusFromOfferAcceptancePhase(
      isInvoiceOnly,
      offerAcceptanceStatus,
      {
        entityApproved,
        invoiceCount: refreshed.invoices.length,
      }
    );
    if (resolved) {
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: resolved },
      });
    }
  }

  private collectInvoiceScopeKeys(application: {
    invoices?: { id: string; details?: unknown }[];
  }): string[] {
    const invoices = application.invoices ?? [];
    return invoices.map((invoice, idx) => {
      const details = invoice.details as { number?: string | number } | null | undefined;
      const invoiceNo = details?.number ?? idx + 1;
      const sanitized = String(invoiceNo).replace(/:/g, "_");
      return `invoice_details:${idx}:${sanitized}`;
    });
  }

  /**
   * Updates invoice_details section row from per-invoice review items and logs SECTION_* when it changes.
   */
  private async syncInvoiceDetailsSectionFromItems(
    repository: AdminRepository,
    applicationId: string,
    application: {
      invoices?: { id: string; details?: unknown }[];
      application_reviews?: { section: string; status: string }[];
      application_review_items?: { item_type: string; item_id: string; status: string }[];
    },
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const invoiceKeys = this.collectInvoiceScopeKeys(application);
    if (invoiceKeys.length === 0) {
      return;
    }

    const invoiceRows =
      application.application_review_items?.filter((r) => r.item_type === "invoice") ?? [];
    const target = computeInvoiceDetailsSectionStatus(
      invoiceKeys,
      invoiceRows.map((r) => ({ item_id: r.item_id, status: r.status }))
    );

    const existing = application.application_reviews?.find((r) => r.section === "invoice_details");
    const current = existing?.status ?? "PENDING";

    if (target === current) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await repository.ensureApplicationReviewSection(applicationId, "invoice_details", tx);
      await repository.updateSectionReviewStatus(
        applicationId,
        "invoice_details",
        target,
        reviewerUserId,
        tx
      );
      await this.logReviewActivity(
        applicationId,
        "section",
        "invoice_details",
        current,
        target,
        reviewerUserId,
        null,
        logContext,
        tx
      );
    });

    if (target === "APPROVED") {
      await repository.removeDraftAmendment(applicationId, "section", "invoice_details");
    }
  }

  private reviewSectionPrefixFromScopeKey(scopeKey: string): string | undefined {
    if (scopeKey.startsWith("supporting_documents:")) return "supporting_documents";
    if (scopeKey.startsWith("acceptance_documents:")) return "acceptance_documents";
    if (scopeKey.startsWith("invoice_details:")) return "invoice_details";
    const colon = scopeKey.indexOf(":");
    return colon > 0 ? scopeKey.slice(0, colon) : undefined;
  }

  private async logReviewActivity(
    applicationId: string,
    scope: "section" | "item",
    scopeKey: string,
    oldStatus: string | null,
    newStatus: string,
    reviewerUserId: string | null,
    remark: string | null,
    logContext?: AdminLogContext,
    db: Prisma.TransactionClient | typeof prisma = prisma,
    includeSubmittedRemarks = false
  ): Promise<void> {
    if (!reviewerUserId) return;
    const previousStatus = oldStatus ?? "PENDING";
    if (previousStatus === newStatus) return;

    const isSection = scope === "section";
    const metadata: Record<string, unknown> = {
      previousStatus,
      newStatus,
    };
    if (isSection) {
      metadata.section = scopeKey;
    } else {
      metadata.itemId = scopeKey;
      const section = this.reviewSectionPrefixFromScopeKey(scopeKey);
      if (section) metadata.section = section;
    }
    if (includeSubmittedRemarks && newStatus === "AMENDMENT_REQUESTED" && remark) {
      metadata.remarks = remark;
    }

    await writeApplicationAuditLog(
      {
        eventType: isSection
          ? "APPLICATION_SECTION_REVIEW_UPDATED"
          : "APPLICATION_ITEM_REVIEW_UPDATED",
        context: adminApplicationAuditContext(reviewerUserId, {
          ipAddress: logContext?.ipAddress,
          userAgent: logContext?.userAgent,
        }),
        applicationId,
        targetType: isSection
          ? APPLICATION_AUDIT_TARGET_TYPE.REVIEW_SECTION
          : APPLICATION_AUDIT_TARGET_TYPE.REVIEW_ITEM,
        targetId: scopeKey,
        metadata,
      },
      db
    );
  }

  private assertAcceptanceReviewNotInherited(application: {
    financing_structure?: unknown;
  }): void {
    const structure = application.financing_structure as { structure_type?: string } | null;
    if (structure?.structure_type === "existing_contract") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Acceptance was completed in the originating application and cannot be modified on a drawdown application"
      );
    }
  }

  /**
   * Load application and validate it is in a reviewable state. Shared by all review actions.
   */
  private async prepareForReviewAction(applicationId: string): Promise<{
    repository: AdminRepository;
    application: NonNullable<Awaited<ReturnType<AdminRepository["getApplicationById"]>>>;
  }> {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    if (!this.isReviewable(application.status as ApplicationStatus)) {
      throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
    }
    return { repository, application };
  }

  /**
   * Load application for comment actions. Comments are allowed in any state (not just reviewable).
   */
  private async loadApplicationForComment(applicationId: string): Promise<{
    repository: AdminRepository;
    application: NonNullable<Awaited<ReturnType<AdminRepository["getApplicationById"]>>>;
  }> {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    return { repository, application };
  }

  private resolveInvoiceScopeKeyById(
    application: { invoices?: { id: string; details?: { number?: string | number } }[] },
    invoiceId: string
  ): string | null {
    const invoices = application.invoices ?? [];
    const idx = invoices.findIndex((invoice) => invoice.id === invoiceId);
    if (idx < 0) return null;
    const invoiceNo = invoices[idx]?.details?.number ?? idx + 1;
    const sanitized = String(invoiceNo).replace(/:/g, "_");
    return `invoice_details:${idx}:${sanitized}`;
  }

  async patchContractCustomerLargePrivateCompany(
    applicationId: string,
    isLargePrivateCompany: boolean,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    this.ensureContractOfferActionAllowed(application);

    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility");
    }

    const contractId = application.contract_id;
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { customer_details: true, status: true },
    });
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Facility not found");
    }

    const nonEditableStatuses = ["OFFER_SENT", "OFFER_EXPIRED", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
    if (nonEditableStatuses.includes(contract.status as (typeof nonEditableStatuses)[number])) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "Cannot update customer type after the facility offer was sent or finalized"
      );
    }

    const existing = contract.customer_details;
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      throw new AppError(400, "INVALID_STATE", "Customer details are missing; cannot save confirmation");
    }

    const previousValue = (existing as Record<string, unknown>).is_large_private_company === true;
    if (previousValue === isLargePrivateCompany) {
      return repository.getApplicationById(applicationId);
    }

    const merged = {
      ...(existing as Record<string, unknown>),
      is_large_private_company: isLargePrivateCompany,
    };

    await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contractId },
        data: { customer_details: merged as Prisma.InputJsonValue },
      });
      await writeApplicationAuditLog(
        {
          eventType: "CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED",
          context: adminApplicationAuditContext(reviewerUserId, {
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
          }),
          applicationId,
          targetType: APPLICATION_AUDIT_TARGET_TYPE.CONTRACT,
          targetId: contractId,
          metadata: {
            previousValue,
            newValue: isLargePrivateCompany,
          },
        },
        tx
      );
    });

    return repository.getApplicationById(applicationId);
  }

  async sendContractOffer(
    applicationId: string,
    offeredFacility: number,
    facilityFeeRatePercent: number | null,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    this.ensureContractOfferActionAllowed(application);

    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility to offer");
    }

    const contractId = application.contract_id;
    await this.assertNoActiveSigningPackage(applicationId, { contractId }, "sending a new facility offer");

    const workflow = await this.loadApplicationProductWorkflow(application);
    const stampOfferAcceptance = workflowUsesOfferAcceptanceFlow(workflow);

    const contractOfferMeta = await prisma.$transaction(async (tx) => {
      const lockedApplications = await tx.$queryRaw<{ status: string }[]>`
        SELECT status
        FROM applications
        WHERE id = ${applicationId}
        FOR UPDATE
      `;
      const lockedApplication = lockedApplications[0];
      if (!lockedApplication) {
        throw new AppError(404, "NOT_FOUND", "Application not found");
      }
      if (!this.isReviewable(lockedApplication.status as ApplicationStatus)) {
        throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
      }

      const lockedContracts = await tx.$queryRaw<
        {
          status: string;
          contract_details: Prisma.JsonValue | null;
          customer_details: Prisma.JsonValue | null;
          offer_details: Prisma.JsonValue | null;
          updated_at: Date;
        }[]
      >`
        SELECT status, contract_details, customer_details, offer_details, updated_at
        FROM contracts
        WHERE id = ${contractId}
        FOR UPDATE
      `;
      const lockedContract = lockedContracts[0];
      if (!lockedContract) {
        throw new AppError(404, "NOT_FOUND", "Facility not found");
      }
      if (lockedContract.status === "APPROVED") {
        throw new AppError(
          400,
          "OFFER_FINALIZED",
          "Facility offer was finalized by issuer and cannot be modified"
        );
      }

      const customerDetailsLocked =
        (lockedContract.customer_details as Record<string, unknown> | null) ?? null;
      const largePrivate = customerDetailsLocked?.is_large_private_company;
      if (typeof largePrivate !== "boolean") {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Please confirm if customer is a large private company"
        );
      }

      const contractDetails = (lockedContract.contract_details as Record<string, unknown> | null) ?? null;
      const requestedFacility = resolveRequestedFacility(contractDetails);
      if (!Number.isFinite(requestedFacility) || requestedFacility <= 0) {
        throw new AppError(400, "INVALID_STATE", "Requested facility is invalid");
      }
      if (offeredFacility > requestedFacility) {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Offered facility cannot be greater than requested facility"
        );
      }

      const previousOffer = (lockedContract.offer_details as Record<string, unknown> | null) ?? null;
      if (stampOfferAcceptance && lockedContract.status !== "OFFER_EXPIRED") {
        this.assertOfferAcceptanceAllowsResend(previousOffer);
      }
      const previousVersion =
        typeof previousOffer?.version === "number" && Number.isFinite(previousOffer.version)
          ? previousOffer.version
          : 0;
      const now = new Date().toISOString();
      const offerDetails: Record<string, unknown> = {
        requested_facility: requestedFacility,
        offered_facility: offeredFacility,
        facility_fee_rate_percent: facilityFeeRatePercent,
        sent_at: now,
        responded_at: null,
        sent_by_user_id: reviewerUserId,
        responded_by_user_id: null,
        version: previousVersion + 1,
        ...(stampOfferAcceptance
          ? { offer_acceptance: buildOfferAcceptanceOnSend(workflow, now) }
          : {}),
      };

      const updateResult = await tx.contract.updateMany({
        where: { id: contractId, updated_at: lockedContract.updated_at },
        data: {
          status: "OFFER_SENT",
          offer_details: offerDetails as Prisma.InputJsonValue,
        },
      });
      if (updateResult.count !== 1) {
        throw new AppError(
          409,
          "CONFLICT",
          "Facility was modified concurrently. Refresh and retry sending offer."
        );
      }

      if (stampOfferAcceptance) {
        await this.resetAcceptanceReviewForNewOfferInTx(tx, applicationId, application, workflow);
      }

      await tx.applicationReview.upsert({
        where: {
          application_id_section: {
            application_id: applicationId,
            section: "contract_details",
          },
        },
        create: {
          application_id: applicationId,
          section: "contract_details",
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
        update: {
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
      });

      await tx.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.CONTRACT_SENT },
      });

      const contractDetailsNumber =
        contractDetails?.number != null && String(contractDetails.number).trim() !== ""
          ? String(contractDetails.number).trim()
          : undefined;
      await writeApplicationAuditLog(
        {
          eventType: "CONTRACT_OFFER_SENT",
          context: adminApplicationAuditContext(reviewerUserId, {
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
          }),
          applicationId,
          targetType: APPLICATION_AUDIT_TARGET_TYPE.CONTRACT,
          targetId: contractId,
          metadata: {
            previousStatus: lockedContract.status,
            newStatus: "OFFER_SENT",
            offeredFacility,
            ...(contractDetailsNumber ? { contractNumber: contractDetailsNumber } : {}),
          },
        },
        tx
      );

      const acceptanceExpiresAt = stampOfferAcceptance
        ? (getOfferAcceptanceFromOfferDetails(offerDetails)?.acceptance_expires_at ?? null)
        : null;

      return {
        requestedFacility,
        previousVersion,
        acceptanceExpiresAt,
      };
    });

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.CONTRACT_OFFER_SENT,
        {
          applicationId,
          offeredFacility,
          expiresAt: contractOfferMeta.acceptanceExpiresAt,
        },
        `contract-offer-sent:${contractOfferMeta.previousVersion + 1}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId, contractId },
        "Failed to send facility offer notification to issuer"
      );
    }

    return repository.getApplicationById(applicationId);
  }

  /**
   * Restamp signing_expires_at after the signing clock passed (soft or durable OFFER_EXPIRED).
   * Keeps acceptance docs / commercial terms; restores OFFER_SENT when durable-expired.
   */
  async extendContractSigningDeadline(
    applicationId: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.ensureContractOfferActionAllowed(application);

    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no facility to extend");
    }

    const contractId = application.contract_id;
    const workflow = await this.loadApplicationProductWorkflow(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "This product does not use the offer-acceptance signing flow"
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    await prisma.$transaction(async (tx) => {
      const locked = await tx.contract.findUnique({
        where: { id: contractId },
        select: { id: true, status: true, offer_details: true },
      });
      if (!locked) {
        throw new AppError(404, "NOT_FOUND", "Facility not found");
      }
      if (locked.status !== "OFFER_SENT" && locked.status !== "OFFER_EXPIRED") {
        throw new AppError(
          400,
          "INVALID_STATE",
          `Cannot extend signing deadline when contract status is ${locked.status}`
        );
      }

      const offer = (locked.offer_details as Record<string, unknown> | null) ?? {};
      const current = getOfferAcceptanceFromOfferDetails(offer);
      if (!current || !SIGNING_ACTIVE.has(current.status)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Signing deadline can only be extended after acceptance is approved for signing"
        );
      }
      const expiresAt = current.signing_expires_at;
      if (typeof expiresAt !== "string" || !expiresAt || !isPhaseDeadlineExpired(expiresAt, now)) {
        throw new AppError(400, "INVALID_STATE", "Signing deadline has not expired yet");
      }

      const deadlinePatch = signingDeadlinePatchOnExtend(workflow, nowIso, current);
      const newDeadline =
        typeof deadlinePatch.signing_expires_at === "string"
          ? deadlinePatch.signing_expires_at
          : null;
      if (!newDeadline) {
        throw new AppError(500, "INTERNAL_ERROR", "Signing deadline extension did not produce a new deadline");
      }

      const nextStatus =
        current.status === "SIGNING_IN_PROGRESS" ? "APPROVED_FOR_SIGNING" : current.status;
      const updated = patchOfferAcceptance(offer, {
        status: nextStatus,
        ...deadlinePatch,
      });

      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: "OFFER_SENT",
          offer_details: updated as Prisma.InputJsonValue,
        },
      });

      if (locked.status === "OFFER_EXPIRED") {
        await tx.applicationReview.upsert({
          where: {
            application_id_section: {
              application_id: applicationId,
              section: "contract_details",
            },
          },
          create: {
            application_id: applicationId,
            section: "contract_details",
            status: ReviewStepStatus.OFFER_SENT,
            reviewer_user_id: reviewerUserId,
            reviewed_at: new Date(),
          },
          update: {
            status: ReviewStepStatus.OFFER_SENT,
            reviewer_user_id: reviewerUserId,
            reviewed_at: new Date(),
          },
        });
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.CONTRACT_SENT },
        });
      }

      await writeApplicationAuditLog(
        {
          eventType: "CONTRACT_SIGNING_DEADLINE_EXTENDED",
          context: adminApplicationAuditContext(reviewerUserId, {
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
          }),
          applicationId,
          targetType: APPLICATION_AUDIT_TARGET_TYPE.CONTRACT,
          targetId: contractId,
          metadata: {
            previousDeadline: expiresAt,
            newDeadline,
            clock: "SIGNING",
          },
        },
        tx
      );
    });

    return repository.getApplicationById(applicationId);
  }

  async sendInvoiceOffer(
    applicationId: string,
    invoiceId: string,
    offeredAmount: number,
    offeredRatioPercent: number | null,
    offeredProfitRatePercent: number | null,
    platformFeeRatePercent: number | null,
    riskRating: SoukscoreRiskRating,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );

    const invoice = (application.invoices as { id: string; details?: Record<string, unknown> }[] | undefined)?.find(
      (row) => row.id === invoiceId
    );
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }

    const scopeKey = this.resolveInvoiceScopeKeyById(
      application as { invoices?: { id: string; details?: { number?: string | number } }[] },
      invoiceId
    );
    if (!scopeKey) {
      throw new AppError(400, "INVALID_STATE", "Unable to resolve invoice scope key");
    }
    await this.ensureInvoiceOfferItemActionAllowed(applicationId, scopeKey, application);
    await this.assertNoActiveSigningPackage(applicationId, { invoiceId }, "sending a new invoice offer");

    const invoiceForSend = await prisma.invoice.findUnique({
      where: { id: invoiceId, application_id: applicationId },
      select: { status: true, contract_id: true },
    });
    if (invoiceForSend?.status === "REJECTED") {
      throw new AppError(
        400,
        "INVALID_STATE",
        "Invoice was rejected; reset review to pending before sending an offer"
      );
    }

    const workflow = await this.loadApplicationProductWorkflow(application);
    const stampOfferAcceptance =
      workflowUsesOfferAcceptanceFlow(workflow) && !invoiceForSend?.contract_id;

    // Use frozen application.product_version workflow (same as load above) — not live catalog.
    const invoiceDetailsForMaturity = (invoice.details as Record<string, unknown> | null) ?? {};
    assertMaturityForSendInvoiceOffer(workflow, invoiceDetailsForMaturity);

    const invoiceOfferMeta = await prisma.$transaction(async (tx) => {
      const lockedApplications = await tx.$queryRaw<{ status: string }[]>`
        SELECT status
        FROM applications
        WHERE id = ${applicationId}
        FOR UPDATE
      `;
      const lockedApplication = lockedApplications[0];
      if (!lockedApplication) {
        throw new AppError(404, "NOT_FOUND", "Application not found");
      }
      if (!this.isReviewable(lockedApplication.status as ApplicationStatus)) {
        throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
      }

      const lockedInvoices = await tx.$queryRaw<
        {
          status: string;
          details: Prisma.JsonValue | null;
          offer_details: Prisma.JsonValue | null;
          contract_id: string | null;
          updated_at: Date;
        }[]
      >`
        SELECT status, details, offer_details, contract_id, updated_at
        FROM invoices
        WHERE id = ${invoiceId} AND application_id = ${applicationId}
        FOR UPDATE
      `;
      const lockedInvoice = lockedInvoices[0];
      if (!lockedInvoice) {
        throw new AppError(404, "NOT_FOUND", "Invoice not found");
      }
      if (lockedInvoice.status === "APPROVED") {
        throw new AppError(
          400,
          "OFFER_FINALIZED",
          "Invoice offer was finalized by issuer and cannot be modified"
        );
      }

      const details = (lockedInvoice.details as Record<string, unknown> | null) ?? {};
      const invoiceValue = Number(details.value);
      const requestedRatioPercent =
        typeof details.financing_ratio_percent === "number"
          ? details.financing_ratio_percent
          : Number(details.financing_ratio_percent ?? 0);
      if (!Number.isFinite(invoiceValue) || invoiceValue <= 0) {
        throw new AppError(400, "INVALID_STATE", "Invoice value is invalid");
      }
      if (!Number.isFinite(requestedRatioPercent) || requestedRatioPercent <= 0) {
        throw new AppError(400, "INVALID_STATE", "Invoice requested financing ratio is invalid");
      }

      const requestedAmount = (invoiceValue * requestedRatioPercent) / 100;
      if (offeredAmount > requestedAmount) {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Offered amount cannot be greater than requested amount"
        );
      }
      const platformFinanceSettings = await tx.platformFinanceSetting.upsert({
        where: { key: "DEFAULT" },
        update: {},
        create: { key: "DEFAULT" },
        select: { platform_fee_rate_cap_percent: true },
      });
      const platformFeeRateCapPercent = Number(platformFinanceSettings.platform_fee_rate_cap_percent);
      const platformFeeStored =
        platformFeeRatePercent != null && Number.isFinite(platformFeeRatePercent)
          ? Math.max(0, Math.round(platformFeeRatePercent * 100) / 100)
          : 0;
      if (platformFeeStored > platformFeeRateCapPercent) {
        throw new AppError(
          422,
          "PLATFORM_FEE_CAP_EXCEEDED",
          `Platform fee rate cannot exceed ${platformFeeRateCapPercent}%`
        );
      }

      const previousOffer = (lockedInvoice.offer_details as Record<string, unknown> | null) ?? null;
      if (stampOfferAcceptance && lockedInvoice.status !== "OFFER_EXPIRED") {
        this.assertOfferAcceptanceAllowsResend(previousOffer);
      }
      const previousVersion =
        typeof previousOffer?.version === "number" && Number.isFinite(previousOffer.version)
          ? previousOffer.version
          : 0;
      const now = new Date().toISOString();
      logger.info({ applicationId, invoiceId, riskRating }, "Saving invoice offer risk rating");
      const offerDetails: Record<string, unknown> = {
        requested_amount: requestedAmount,
        offered_amount: offeredAmount,
        requested_ratio_percent: requestedRatioPercent,
        offered_ratio_percent: offeredRatioPercent,
        offered_profit_rate_percent: offeredProfitRatePercent,
        platform_fee_rate_percent: platformFeeStored,
        risk_rating: riskRating,
        sent_at: now,
        responded_at: null,
        sent_by_user_id: reviewerUserId,
        responded_by_user_id: null,
        version: previousVersion + 1,
        ...(stampOfferAcceptance
          ? { offer_acceptance: buildOfferAcceptanceOnSend(workflow, now) }
          : {}),
      };

      const updateResult = await tx.invoice.updateMany({
        where: {
          id: invoiceId,
          application_id: applicationId,
          updated_at: lockedInvoice.updated_at,
        },
        data: {
          status: "OFFER_SENT",
          offer_details: offerDetails as Prisma.InputJsonValue,
        },
      });
      if (updateResult.count !== 1) {
        throw new AppError(
          409,
          "CONFLICT",
          "Invoice was modified concurrently. Refresh and retry sending offer."
        );
      }

      if (stampOfferAcceptance) {
        await this.resetAcceptanceReviewForNewOfferInTx(tx, applicationId, application, workflow);
      }

      await tx.applicationReviewItem.upsert({
        where: {
          application_id_item_type_item_id: {
            application_id: applicationId,
            item_type: "invoice",
            item_id: scopeKey,
          },
        },
        create: {
          application_id: applicationId,
          item_type: "invoice",
          item_id: scopeKey,
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
        update: {
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
      });

      if (application.contract_id) {
        await refreshContractFacilityValues(application.contract_id, tx);
      }

      const invoiceStatuses = (
        await tx.invoice.findMany({
          where: { application_id: applicationId },
          select: { status: true },
        })
      ).map((row) => row.status);
      const nextApplicationStatus = this.allInvoicesOfferableOrResolved(invoiceStatuses)
        ? ApplicationStatus.INVOICES_SENT
        : ApplicationStatus.INVOICE_PENDING;
      await tx.application.update({
        where: { id: applicationId },
        data: { status: nextApplicationStatus },
      });

      const invoiceNumber =
        details.number != null && details.number !== ""
          ? String(details.number).trim()
          : null;
      await writeApplicationAuditLog(
        {
          eventType: "INVOICE_OFFER_SENT",
          context: adminApplicationAuditContext(reviewerUserId, {
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
          }),
          applicationId,
          targetType: APPLICATION_AUDIT_TARGET_TYPE.INVOICE,
          targetId: invoiceId,
          metadata: {
            previousStatus: lockedInvoice.status,
            newStatus: "OFFER_SENT",
            offeredAmount,
            ...(invoiceNumber ? { invoiceNumber } : {}),
          },
        },
        tx
      );
      const acceptanceExpiresAt = stampOfferAcceptance
        ? (getOfferAcceptanceFromOfferDetails(offerDetails)?.acceptance_expires_at ?? null)
        : null;
      return {
        invoiceNumber,
        requestedAmount,
        previousVersion,
        platformFeeStored,
        acceptanceExpiresAt,
      };
    });

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.INVOICE_OFFER_SENT,
        {
          applicationId,
          invoiceId,
          invoiceNumber: invoiceOfferMeta.invoiceNumber,
          offeredAmount,
          expiresAt: invoiceOfferMeta.acceptanceExpiresAt,
        },
        `invoice-offer-sent:${invoiceId}:${invoiceOfferMeta.previousVersion + 1}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId, invoiceId },
        "Failed to send invoice offer notification to issuer"
      );
    }

    let nextApp = await repository.getApplicationById(applicationId);
    if (nextApp) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Restamp signing_expires_at for an invoice-only offer after the signing clock passed.
   */
  async extendInvoiceSigningDeadline(
    applicationId: string,
    invoiceId: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);

    const invoiceExists = (application.invoices ?? []).some((inv) => inv.id === invoiceId);
    if (!invoiceExists) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found on this application");
    }

    const workflow = await this.loadApplicationProductWorkflow(application);
    if (!workflowUsesOfferAcceptanceFlow(workflow)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        "This product does not use the offer-acceptance signing flow"
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const scopeKey = this.resolveInvoiceScopeKeyById(
      application as { invoices?: { id: string; details?: { number?: string | number } }[] },
      invoiceId
    );

    await prisma.$transaction(async (tx) => {
      const locked = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, status: true, offer_details: true, contract_id: true },
      });
      if (!locked) {
        throw new AppError(404, "NOT_FOUND", "Invoice not found");
      }
      if (locked.contract_id) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Contract-linked invoices do not use the acceptance signing deadline flow"
        );
      }
      if (locked.status !== "OFFER_SENT" && locked.status !== "OFFER_EXPIRED") {
        throw new AppError(
          400,
          "INVALID_STATE",
          `Cannot extend signing deadline when invoice status is ${locked.status}`
        );
      }

      const offer = (locked.offer_details as Record<string, unknown> | null) ?? {};
      const current = getOfferAcceptanceFromOfferDetails(offer);
      if (!current || !SIGNING_ACTIVE.has(current.status)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Signing deadline can only be extended after acceptance is approved for signing"
        );
      }
      const expiresAt = current.signing_expires_at;
      if (typeof expiresAt !== "string" || !expiresAt || !isPhaseDeadlineExpired(expiresAt, now)) {
        throw new AppError(400, "INVALID_STATE", "Signing deadline has not expired yet");
      }

      const deadlinePatch = signingDeadlinePatchOnExtend(workflow, nowIso, current);
      const newDeadline =
        typeof deadlinePatch.signing_expires_at === "string"
          ? deadlinePatch.signing_expires_at
          : null;
      if (!newDeadline) {
        throw new AppError(500, "INTERNAL_ERROR", "Signing deadline extension did not produce a new deadline");
      }

      const nextStatus =
        current.status === "SIGNING_IN_PROGRESS" ? "APPROVED_FOR_SIGNING" : current.status;
      const updated = patchOfferAcceptance(offer, {
        status: nextStatus,
        ...deadlinePatch,
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "OFFER_SENT",
          offer_details: updated as Prisma.InputJsonValue,
        },
      });

      if (locked.status === "OFFER_EXPIRED") {
        await tx.applicationReviewItem.updateMany({
          where: {
            application_id: applicationId,
            item_type: "invoice",
            OR: [{ item_id: invoiceId }, ...(scopeKey ? [{ item_id: scopeKey }] : [])],
          },
          data: {
            status: ReviewStepStatus.OFFER_SENT,
            reviewer_user_id: reviewerUserId,
            reviewed_at: new Date(),
          },
        });
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.INVOICES_SENT },
        });
      }

      await writeApplicationAuditLog(
        {
          eventType: "INVOICE_SIGNING_DEADLINE_EXTENDED",
          context: adminApplicationAuditContext(reviewerUserId, {
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
          }),
          applicationId,
          targetType: APPLICATION_AUDIT_TARGET_TYPE.INVOICE,
          targetId: invoiceId,
          metadata: {
            previousDeadline: expiresAt,
            newDeadline,
            clock: "SIGNING",
          },
        },
        tx
      );
    });

    return repository.getApplicationById(applicationId);
  }

  /**
   * Clear pending item amendment drafts for the given item.
   * itemId is the scope_key (e.g. supporting_documents:..., invoice_details:...).
   */
  private async clearItemDraftAmendments(
    repository: AdminRepository,
    applicationId: string,
    _itemType: "invoice" | "document",
    itemId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    const scopeKeys = new Set<string>([itemId]);
    await Promise.all(
      Array.from(scopeKeys).map((scopeKey) =>
        repository.removeDraftAmendment(applicationId, "item", scopeKey, db)
      )
    );
  }

  /**
   * Clear item remark entries for both canonical and legacy scope_key formats.
   * Used by reset-to-pending to fully clear the item's current remark entry.
   */
  private async clearItemRemarks(
    repository: AdminRepository,
    applicationId: string,
    _itemType: "invoice" | "document",
    itemId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    const scopeKeys = new Set<string>([itemId]);
    await Promise.all(
      Array.from(scopeKeys).map((scopeKey) =>
        repository.removeReviewRemark(applicationId, "item", scopeKey, db)
      )
    );
  }

  /**
   * Approve a review section
   */
  async approveReviewSection(
    applicationId: string,
    section: ReviewSection,
    reviewerUserId: string,
    remark?: string | null,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    if (section === "financial") {
      this.assertFinancialReviewDirectorShareholderAmlApproved(application);
    }
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (section === "supporting_documents" || section === "acceptance_documents") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        section === "supporting_documents"
          ? "Documents section status is derived from per-document reviews; approve each document instead"
          : "Acceptance section status is derived from per-document reviews; approve each document instead"
      );
    }
    if (section === "contract_details" || section === "invoice_details") {
      const structure = application.financing_structure as { structure_type?: string } | null | undefined;
      const isInvoiceOnly = structure?.structure_type === "invoice_only";
      const contractApprovalAllowed = section === "contract_details" && isInvoiceOnly;
      if (!contractApprovalAllowed) {
        throw new AppError(
          400,
          "INVALID_ACTION",
          "Facility and invoice approvals must be finalized by issuer offer response"
        );
      }
    }
    await repository.ensureApplicationReviewSection(applicationId, section);

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";

    await prisma.$transaction(async (tx) => {
      await repository.updateSectionReviewStatus(
        applicationId,
        section,
        ReviewStepStatus.APPROVED,
        reviewerUserId,
        tx
      );
      const remarkValue = remark?.trim() || null;
      if (remarkValue) {
        await repository.upsertReviewRemark(
          applicationId,
          "section",
          section,
          "APPROVE",
          remarkValue,
          reviewerUserId,
          tx
        );
      }
      await this.logReviewActivity(
        applicationId,
        "section",
        section,
        oldStatus,
        "APPROVED",
        reviewerUserId,
        null,
        logContext,
        tx
      );
      await repository.removeDraftAmendment(applicationId, "section", section, tx);
    });

    const nextApp = await repository.getApplicationById(applicationId);
    if (nextApp) {
      await this.syncAdminStageStatus(repository, applicationId, nextApp, reviewerUserId, logContext);
      return repository.getApplicationById(applicationId);
    }
    return nextApp;
  }

  /**
   * Reset a review section to PENDING (undoes approve/reject/amendment for that section).
   */
  async resetSectionReviewToPending(
    applicationId: string,
    section: ReviewSection,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (section === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (section === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }
    if (section === "acceptance_documents") {
      this.assertAcceptanceReviewNotInherited(application);
      await this.assertNoActiveSigningPackageForAcceptanceActions(
        applicationId,
        application,
        "resetting acceptance documents section"
      );
    }

    await this.assertResetReviewToPendingAllowed(applicationId, section, application);

    if (section === "supporting_documents") {
      const docKeys = [...this.collectDocumentKeys(application.supporting_documents)];
      if (docKeys.length > 0) {
        for (const itemId of docKeys) {
          await this.resetItemReviewToPending(applicationId, "document", itemId, reviewerUserId, logContext, {
            skipSupportingDocumentsSectionSync: true,
            skipItemActivityLog: true,
          });
        }
        let nextApp = await repository.getApplicationById(applicationId);
        if (nextApp) {
          await this.syncSupportingDocumentsSectionFromItems(
            repository,
            applicationId,
            nextApp,
            reviewerUserId,
            logContext
          );
          nextApp = await repository.getApplicationById(applicationId);
        }
        await repository.removeDraftAmendment(applicationId, "section", section);
        logger.info({ applicationId, section, reviewerUserId }, "Review section reset to pending");
        return nextApp ?? repository.getApplicationById(applicationId);
      }
    }

    if (section === "acceptance_documents") {
      const docKeys = [
        ...this.collectAcceptanceDocumentKeys(
          (application as { acceptance_documents?: unknown }).acceptance_documents
        ),
      ];
      if (docKeys.length > 0) {
        for (const itemId of docKeys) {
          await this.resetItemReviewToPending(applicationId, "document", itemId, reviewerUserId, logContext, {
            skipSupportingDocumentsSectionSync: true,
            skipItemActivityLog: true,
            skipOfferAcceptancePhaseSync: true,
          });
        }
        let nextApp = await repository.getApplicationById(applicationId);
        if (nextApp) {
          await this.syncAcceptanceDocumentsSectionFromItems(
            repository,
            applicationId,
            nextApp as {
              acceptance_documents?: unknown;
              application_reviews?: { section: string; status: string }[];
              application_review_items?: { item_type: string; item_id: string; status: string }[];
              contract?: { offer_details?: unknown } | null;
              invoices?: Array<{ contract_id?: string | null; offer_details?: unknown }>;
            },
            reviewerUserId,
            logContext
          );
          nextApp = await repository.getApplicationById(applicationId);
          await this.syncOfferAcceptancePhaseFromAcceptanceDocs(
            applicationId,
            nextApp as {
              financing_type?: unknown;
              product_version?: number | null;
              supporting_documents?: unknown;
              acceptance_documents?: unknown;
              contract?: {
                id: string;
                status: string;
                offer_details?: unknown;
              } | null;
              invoices?: Array<{
                id: string;
                status: string;
                contract_id?: string | null;
                offer_details?: unknown;
              }>;
              application_review_items?: Array<{
                item_type: string;
                item_id: string;
                status: string;
              }>;
            },
            reviewerUserId,
            logContext
          );
          nextApp = await repository.getApplicationById(applicationId);
        }
        await repository.removeDraftAmendment(applicationId, "section", section);
        logger.info({ applicationId, section, reviewerUserId }, "Review section reset to pending");
        return nextApp ?? repository.getApplicationById(applicationId);
      }
    }

    if (section === "invoice_details") {
      const invoices = application.invoices ?? [];
      if (invoices.length > 0) {
        for (const inv of invoices) {
          const scopeKey = this.resolveInvoiceScopeKeyById(
            application as { invoices?: { id: string; details?: { number?: string | number } }[] },
            inv.id
          );
          if (!scopeKey) continue;
          await this.resetItemReviewToPending(applicationId, "invoice", scopeKey, reviewerUserId, logContext, {
            skipInvoiceDetailsSectionSync: true,
            skipItemActivityLog: true,
          });
        }
        let nextApp = await repository.getApplicationById(applicationId);
        if (nextApp) {
          await this.syncInvoiceDetailsSectionFromItems(
            repository,
            applicationId,
            nextApp,
            reviewerUserId,
            logContext
          );
          nextApp = await repository.getApplicationById(applicationId);
        }
        await repository.removeDraftAmendment(applicationId, "section", section);
        await repository.updateApplicationStatus(applicationId, ApplicationStatus.INVOICE_PENDING);
        logger.info({ applicationId, section, reviewerUserId }, "Review section reset to pending");
        return nextApp ?? repository.getApplicationById(applicationId);
      }
    }

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";
    let didRetractContractOffer = false;

    if (section === "contract_details" && application.contract_id) {
      await this.assertNoActiveSigningPackage(
        applicationId,
        { contractId: application.contract_id },
        "retracting a facility offer"
      );
    }

    const contractId = section === "contract_details" ? application.contract_id : null;
    const contract =
      contractId != null
        ? await prisma.contract.findUnique({
            where: { id: contractId },
            select: { status: true },
          })
        : null;
    const contractUpdateData: Prisma.ContractUpdateInput = {
      status: "SUBMITTED",
    };
    didRetractContractOffer = oldStatus === "OFFER_SENT" || contract?.status === "OFFER_SENT";
    if (didRetractContractOffer) {
      contractUpdateData.offer_details = Prisma.JsonNull;
    }
    const structure = application.financing_structure as { structure_type?: string } | null | undefined;
    const isInvoiceOnly = structure?.structure_type === "invoice_only";

    await prisma.$transaction(async (tx) => {
      await repository.resetSectionReviewToPending(applicationId, section, tx);
      if (contractId) {
        await tx.contract.update({
          where: { id: contractId },
          data: contractUpdateData,
        });
        await refreshContractFacilityValues(contractId, tx);
        if (didRetractContractOffer) {
          await writeApplicationAuditLog(
            {
              eventType: "CONTRACT_OFFER_RETRACTED",
              context: adminApplicationAuditContext(reviewerUserId, {
                ipAddress: logContext?.ipAddress,
                userAgent: logContext?.userAgent,
              }),
              applicationId,
              targetType: APPLICATION_AUDIT_TARGET_TYPE.CONTRACT,
              targetId: contractId,
              metadata: {
                previousStatus: contract?.status === "OFFER_SENT" ? "OFFER_SENT" : oldStatus,
                newStatus: "SUBMITTED",
              },
            },
            tx
          );
        }
      }
      await this.logReviewActivity(
        applicationId,
        "section",
        section,
        oldStatus,
        "PENDING",
        reviewerUserId,
        null,
        logContext,
        tx
      );
      await repository.removeDraftAmendment(applicationId, "section", section, tx);
      if (section === "contract_details") {
        await tx.application.update({
          where: { id: applicationId },
          data: {
            status: isInvoiceOnly ? ApplicationStatus.UNDER_REVIEW : ApplicationStatus.CONTRACT_PENDING,
          },
        });
      } else if (section === "invoice_details") {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.INVOICE_PENDING },
        });
      }
    });
    if (didRetractContractOffer && section === "contract_details") {
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.OFFER_RETRACTED_OR_RESET,
          {
            applicationId,
            offerType: "contract",
          },
          `contract-offer-retracted:${section}`
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId, section },
          "Failed to send facility offer retracted/reset notification to issuer"
        );
      }
    }

    logger.info({ applicationId, section, reviewerUserId }, "Review section reset to pending");
    return repository.getApplicationById(applicationId);
  }

  /**
   * Reset a review item to PENDING (undoes approve/reject/amendment for that item).
   */
  async resetItemReviewToPending(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    reviewerUserId: string,
    logContext?: AdminLogContext,
    options?: {
      skipSupportingDocumentsSectionSync?: boolean;
      skipInvoiceDetailsSectionSync?: boolean;
      skipItemActivityLog?: boolean;
      /** Section bulk reset syncs phase once after all items. */
      skipOfferAcceptancePhaseSync?: boolean;
    }
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (itemType === "invoice") {
      await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
    }
    if (itemType === "document" && itemId.startsWith("acceptance_documents:")) {
      await this.assertNoActiveSigningPackageForAcceptanceActions(
        applicationId,
        application,
        "resetting acceptance document review"
      );
    }

    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";
    let didRetractInvoiceOffer = false;

    if (itemType === "invoice") {
      const invoiceId = this.resolveInvoiceIdFromScopeKey(
        application as { invoices?: { id: string; details?: { number?: string | number } }[] },
        itemId
      );
      if (invoiceId) {
        await this.assertNoActiveSigningPackage(
          applicationId,
          { invoiceId },
          "retracting an invoice offer"
        );
      }
    }

    const invoiceIdForReset =
      itemType === "invoice"
        ? this.resolveInvoiceIdFromScopeKey(
            application as { invoices?: { id: string; details?: { number?: string | number } }[] },
            itemId
          )
        : null;
    const currentInvoice =
      invoiceIdForReset != null
        ? await prisma.invoice.findUnique({
            where: { id: invoiceIdForReset, application_id: applicationId },
            select: { status: true },
          })
        : null;
    const invoiceUpdateData: Prisma.InvoiceUpdateInput = { status: "SUBMITTED" };
    didRetractInvoiceOffer =
      invoiceIdForReset != null &&
      (oldStatus === "OFFER_SENT" || currentInvoice?.status === "OFFER_SENT");
    if (didRetractInvoiceOffer) {
      invoiceUpdateData.offer_details = Prisma.JsonNull;
    }

    await prisma.$transaction(async (tx) => {
      await repository.resetItemReviewToPending(applicationId, itemType, itemId, tx);
      if (invoiceIdForReset) {
        await tx.invoice.update({
          where: { id: invoiceIdForReset, application_id: applicationId },
          data: invoiceUpdateData,
        });
        if (didRetractInvoiceOffer) {
          await writeApplicationAuditLog(
            {
              eventType: "INVOICE_OFFER_RETRACTED",
              context: adminApplicationAuditContext(reviewerUserId, {
                ipAddress: logContext?.ipAddress,
                userAgent: logContext?.userAgent,
              }),
              applicationId,
              targetType: APPLICATION_AUDIT_TARGET_TYPE.INVOICE,
              targetId: invoiceIdForReset,
              metadata: {
                previousStatus:
                  currentInvoice?.status === "OFFER_SENT" ? "OFFER_SENT" : oldStatus,
                newStatus: "SUBMITTED",
              },
            },
            tx
          );
        }
      }
      if (!options?.skipItemActivityLog) {
        await this.logReviewActivity(
          applicationId,
          "item",
          itemId,
          oldStatus,
          "PENDING",
          reviewerUserId,
          null,
          logContext,
          tx
        );
      }
      await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId, tx);
      await this.clearItemRemarks(repository, applicationId, itemType, itemId, tx);
      if (itemType === "invoice") {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.INVOICE_PENDING },
        });
      }
    });
    if (itemType === "invoice" && application.contract_id) {
      await this.refreshContractFacilityValues(application.contract_id);
    }
    if (didRetractInvoiceOffer && itemType === "invoice") {
      try {
        const invoiceNumber = itemId.startsWith("invoice_details:")
          ? itemId.split(":").slice(2).join(":") || null
          : null;
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.OFFER_RETRACTED_OR_RESET,
          {
            applicationId,
            offerType: "invoice",
            invoiceNumber,
          },
          `invoice-offer-retracted:${itemId}`
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId, itemId },
          "Failed to send invoice offer retracted/reset notification to issuer"
        );
      }
    }

    logger.info({ applicationId, itemType, itemId, reviewerUserId }, "Review item reset to pending");
    let nextApp = await repository.getApplicationById(applicationId);
    if (
      itemType === "document" &&
      nextApp &&
      !options?.skipSupportingDocumentsSectionSync
    ) {
      await this.syncDocumentDerivedSectionsFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    if (
      itemType === "document" &&
      itemId.startsWith("acceptance_documents:") &&
      nextApp &&
      !options?.skipOfferAcceptancePhaseSync
    ) {
      await this.syncOfferAcceptancePhaseFromAcceptanceDocs(
        applicationId,
        nextApp as {
          financing_type?: unknown;
          product_version?: number | null;
          supporting_documents?: unknown;
          acceptance_documents?: unknown;
          contract?: {
            id: string;
            status: string;
            offer_details?: unknown;
          } | null;
          invoices?: Array<{
            id: string;
            status: string;
            contract_id?: string | null;
            offer_details?: unknown;
          }>;
          application_review_items?: Array<{
            item_type: string;
            item_id: string;
            status: string;
          }>;
        },
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    if (
      itemType === "invoice" &&
      nextApp &&
      !options?.skipInvoiceDetailsSectionSync
    ) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * When one document is rejected: remove amendment drafts on sibling docs in the same
   * section only (acceptance vs supporting), and reset AMENDMENT_REQUESTED peers to PENDING.
   */
  private async clearSiblingDocumentAmendmentsAfterPeerReject(
    repository: AdminRepository,
    applicationId: string,
    application: {
      supporting_documents?: unknown;
      acceptance_documents?: unknown;
      application_review_items?: { item_type: string; item_id: string; status: string }[];
    },
    rejectedItemId: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const isAcceptance = rejectedItemId.startsWith("acceptance_documents:");
    const keys = isAcceptance
      ? [...this.collectAcceptanceDocumentKeys(application.acceptance_documents)]
      : [...this.collectDocumentKeys(application.supporting_documents)];
    for (const key of keys) {
      if (key === rejectedItemId) {
        continue;
      }
      await repository.removeDraftAmendment(applicationId, "item", key);
      const row = application.application_review_items?.find(
        (r) => r.item_type === "document" && r.item_id === key
      );
      if (row?.status === "AMENDMENT_REQUESTED") {
        await this.resetItemReviewToPending(
          applicationId,
          "document",
          key,
          reviewerUserId,
          logContext,
          { skipSupportingDocumentsSectionSync: true, skipOfferAcceptancePhaseSync: true }
        );
      }
    }
  }

  private async assertNoActiveSigningPackageForAcceptanceActions(
    applicationId: string,
    application: {
      contract_id?: string | null;
      invoices?: Array<{ id: string; status: string; contract_id?: string | null }>;
    },
    actionLabel: string
  ): Promise<void> {
    const blockingStatuses = ["SENT", "IN_PROGRESS", "COMPLETED"] as const;

    if (application.contract_id) {
      const sentOrCompleted = await prisma.signingEnvelope.findFirst({
        where: {
          application_id: applicationId,
          contract_id: application.contract_id,
          status: { in: [...blockingStatuses] },
        },
        select: { id: true, status: true },
      });
      if (sentOrCompleted) {
        throw new AppError(
          400,
          "ACTIVE_SIGNING_PACKAGE",
          sentOrCompleted.status === "COMPLETED"
            ? "Signing is complete; acceptance documents cannot be changed."
            : `Void the sent signing package before ${actionLabel}.`
        );
      }
      return;
    }

    for (const invoice of application.invoices ?? []) {
      if (invoice.contract_id) continue;
      if (invoice.status !== "OFFER_SENT") continue;
      const sentOrCompleted = await prisma.signingEnvelope.findFirst({
        where: {
          application_id: applicationId,
          invoice_id: invoice.id,
          status: { in: [...blockingStatuses] },
        },
        select: { id: true, status: true },
      });
      if (sentOrCompleted) {
        throw new AppError(
          400,
          "ACTIVE_SIGNING_PACKAGE",
          sentOrCompleted.status === "COMPLETED"
            ? "Signing is complete; acceptance documents cannot be changed."
            : `Void the sent signing package before ${actionLabel}.`
        );
      }
    }
  }

  /**
   * Reject a review section. Updates section status only; does not change application status.
   * Application-level Reject must be triggered separately when admin finalizes.
   */
  async rejectReviewSection(
    applicationId: string,
    section: ReviewSection,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (section === "supporting_documents" || section === "acceptance_documents") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        section === "supporting_documents"
          ? "Documents section status is derived from per-document reviews; reject documents instead"
          : "Acceptance section status is derived from per-document reviews; reject documents instead"
      );
    }
    if (section === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (section === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }
    await repository.ensureApplicationReviewSection(applicationId, section);

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.updateSectionReviewStatus(
      applicationId,
      section,
      ReviewStepStatus.REJECTED,
      reviewerUserId
    );
    await repository.upsertReviewRemark(
      applicationId,
      "section",
      section,
      "REJECT",
      remark,
      reviewerUserId
    );
    await this.logReviewActivity(
      applicationId,
      "section",
      section,
      oldStatus,
      "REJECTED",
      reviewerUserId,
      remark,
      logContext
    );

    await repository.removeDraftAmendment(applicationId, "section", section);

    logger.info({ applicationId, section, reviewerUserId }, "Review section rejected");
    return repository.getApplicationById(applicationId);
  }

  /**
   * Request amendment for a review section. Updates section status only; does not change application status.
   * Application-level amendment submission must be triggered separately via submitPendingAmendments.
   */
  async requestAmendmentReviewSection(
    applicationId: string,
    section: ReviewSection,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (section === "supporting_documents" || section === "acceptance_documents") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        section === "supporting_documents"
          ? "Documents section status is derived from per-document reviews; request amendments on documents instead"
          : "Acceptance section status is derived from per-document reviews; request amendments on documents instead"
      );
    }
    if (section === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (section === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }
    await repository.ensureApplicationReviewSection(applicationId, section);

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.updateSectionReviewStatus(
      applicationId,
      section,
      ReviewStepStatus.AMENDMENT_REQUESTED,
      reviewerUserId
    );
    await repository.upsertReviewRemark(
      applicationId,
      "section",
      section,
      "REQUEST_AMENDMENT",
      remark,
      reviewerUserId
    );
    await this.logReviewActivity(
      applicationId,
      "section",
      section,
      oldStatus,
      "AMENDMENT_REQUESTED",
      reviewerUserId,
      remark,
      logContext
    );

    await repository.removeDraftAmendment(applicationId, "section", section);

    logger.info({ applicationId, section, reviewerUserId }, "Amendment requested for review section");
    return repository.getApplicationById(applicationId);
  }

  async addSectionComment(
    applicationId: string,
    section: ReviewSection,
    comment: string,
    reviewerUserId: string
  ) {
    const { repository } = await this.loadApplicationForComment(applicationId);

    const commentId = `${Date.now()}-${reviewerUserId}`;
    await repository.createReviewRemark(
      applicationId,
      "comment",
      `${section}:${commentId}`,
      "COMMENT",
      comment.trim(),
      reviewerUserId
    );

    logger.info({ applicationId, section, reviewerUserId }, "Section comment added");
    return repository.getApplicationById(applicationId);
  }

  /**
   * Approve a review item (invoice or document)
   */
  async approveReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    reviewerUserId: string,
    remark?: string | null,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    if (itemType === "document" && itemId.startsWith("acceptance_documents:")) {
      this.assertAcceptanceReviewNotInherited(application);
    }
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (itemType === "invoice") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Invoice approvals must be finalized by issuer offer response"
      );
    }
    if (itemId.startsWith("acceptance_documents:")) {
      await this.assertNoActiveSigningPackageForAcceptanceActions(
        applicationId,
        application,
        "approving acceptance documents"
      );
    }
    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";

    await prisma.$transaction(async (tx) => {
      await repository.upsertItemReviewStatus(
        applicationId,
        itemType,
        itemId,
        ReviewStepStatus.APPROVED,
        reviewerUserId,
        tx
      );
      const remarkValue = remark?.trim() || null;
      if (remarkValue) {
        await repository.upsertReviewRemark(
          applicationId,
          "item",
          itemId,
          "APPROVE",
          remarkValue,
          reviewerUserId,
          tx
        );
      }
      await this.logReviewActivity(
        applicationId,
        "item",
        itemId,
        oldStatus,
        "APPROVED",
        reviewerUserId,
        null,
        logContext,
        tx
      );
      await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId, tx);
    });

    let nextApp = await repository.getApplicationById(applicationId);
    if (itemType === "document" && nextApp) {
      await this.syncDocumentDerivedSectionsFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
      if (itemId.startsWith("acceptance_documents:") && nextApp) {
        await this.syncOfferAcceptancePhaseFromAcceptanceDocs(
          applicationId,
          nextApp as {
            financing_type?: unknown;
            product_version?: number | null;
            supporting_documents?: unknown;
            acceptance_documents?: unknown;
            contract?: {
              id: string;
              status: string;
              offer_details?: unknown;
            } | null;
            invoices?: Array<{
              id: string;
              status: string;
              contract_id?: string | null;
              offer_details?: unknown;
            }>;
            application_review_items?: Array<{
              item_type: string;
              item_id: string;
              status: string;
            }>;
          },
          reviewerUserId,
          logContext
        );
        nextApp = await repository.getApplicationById(applicationId);
      }
    }
    if (nextApp) {
      await this.syncAdminStageStatus(repository, applicationId, nextApp, reviewerUserId, logContext);
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Reject a review item
   */
  async rejectReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (itemType === "invoice") {
      await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
    }
    if (itemType === "document" && itemId.startsWith("acceptance_documents:")) {
      await this.assertNoActiveSigningPackageForAcceptanceActions(
        applicationId,
        application,
        "rejecting acceptance documents"
      );
    }
    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";

    await prisma.$transaction(async (tx) => {
      await repository.upsertItemReviewStatus(
        applicationId,
        itemType,
        itemId,
        ReviewStepStatus.REJECTED,
        reviewerUserId,
        tx
      );
      await repository.upsertReviewRemark(
        applicationId,
        "item",
        itemId,
        "REJECT",
        remark,
        reviewerUserId,
        tx
      );
      await this.logReviewActivity(
        applicationId,
        "item",
        itemId,
        oldStatus,
        "REJECTED",
        reviewerUserId,
        null,
        logContext,
        tx
      );
      await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId, tx);
    });

    if (itemType === "document") {
      await this.clearSiblingDocumentAmendmentsAfterPeerReject(
        repository,
        applicationId,
        application,
        itemId,
        reviewerUserId,
        logContext
      );
    }

    if (itemType === "invoice") {
      const invoiceId = this.resolveInvoiceIdFromScopeKey(
        application as { invoices?: { id: string; details?: { number?: string | number } }[] },
        itemId
      );
      if (invoiceId) {
        await prisma.invoice.update({
          where: { id: invoiceId, application_id: applicationId },
          data: { status: "REJECTED" },
        });
      }
      if (application.contract_id) {
        await this.refreshContractFacilityValues(application.contract_id);
      }
    }

    let nextApp = await repository.getApplicationById(applicationId);
    if (itemType === "document" && nextApp) {
      await this.syncDocumentDerivedSectionsFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
      if (itemId.startsWith("acceptance_documents:") && nextApp) {
        await this.syncOfferAcceptancePhaseFromAcceptanceDocs(
          applicationId,
          nextApp as {
            financing_type?: unknown;
            product_version?: number | null;
            supporting_documents?: unknown;
            acceptance_documents?: unknown;
            contract?: {
              id: string;
              status: string;
              withdraw_reason?: WithdrawReason | null;
              offer_details?: unknown;
            } | null;
            invoices?: Array<{
              id: string;
              status: string;
              contract_id?: string | null;
              withdraw_reason?: WithdrawReason | null;
              offer_details?: unknown;
            }>;
            application_review_items?: Array<{
              item_type: string;
              item_id: string;
              status: string;
            }>;
          },
          reviewerUserId
        );
        nextApp = await repository.getApplicationById(applicationId);
      }
    }
    if (itemType === "invoice" && nextApp) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Request amendment for a review item
   */
  async requestAmendmentReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );
    if (itemType === "invoice") {
      await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
    }
    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";
    const isAcceptanceDoc =
      itemType === "document" && isAcceptanceDocumentItemId(itemId);
    if (isAcceptanceDoc) {
      assertAcceptanceDocumentChangeRequestAllowed(oldStatus);
      await this.assertNoActiveSigningPackageForAcceptanceActions(
        applicationId,
        application,
        "requesting acceptance document changes"
      );
    }

    await prisma.$transaction(async (tx) => {
      await repository.upsertItemReviewStatus(
        applicationId,
        itemType,
        itemId,
        ReviewStepStatus.AMENDMENT_REQUESTED,
        reviewerUserId,
        tx
      );
      // Clear stale draft rows before persisting the committed remark — running after upsert
      // would delete the remark we just wrote (removeDraftAmendment targets submitted_at=null).
      await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId, tx);
      await repository.upsertReviewRemark(
        applicationId,
        "item",
        itemId,
        "REQUEST_AMENDMENT",
        remark,
        reviewerUserId,
        tx
      );
      if (isAcceptanceDoc) {
        await repository.markReviewRemarkSubmitted(applicationId, "item", itemId, tx);
      }
      await this.logReviewActivity(
        applicationId,
        "item",
        itemId,
        oldStatus,
        "AMENDMENT_REQUESTED",
        reviewerUserId,
        remark,
        logContext,
        tx,
        isAcceptanceDoc
      );
      if (itemType === "invoice") {
        const invoiceId = this.resolveInvoiceIdFromScopeKey(
          application as { invoices?: { id: string; details?: { number?: string | number } }[] },
          itemId
        );
        if (invoiceId) {
          await tx.invoice.update({
            where: { id: invoiceId, application_id: applicationId },
            data: { status: "AMENDMENT_REQUESTED" },
          });
        }
      }
    });

    if (application.contract_id) {
      await this.refreshContractFacilityValues(application.contract_id);
    }

    let nextApp = await repository.getApplicationById(applicationId);
    const acceptancePhaseBefore = isAcceptanceDoc
      ? this.getPrimaryOfferAcceptanceStatus(application)
      : null;

    if (itemType === "document" && nextApp) {
      await this.syncDocumentDerivedSectionsFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
      if (isAcceptanceDoc && nextApp) {
        await this.syncOfferAcceptancePhaseFromAcceptanceDocs(
          applicationId,
          nextApp as {
            financing_type?: unknown;
            product_version?: number | null;
            supporting_documents?: unknown;
            acceptance_documents?: unknown;
            contract?: {
              id: string;
              status: string;
              offer_details?: unknown;
            } | null;
            invoices?: Array<{
              id: string;
              status: string;
              contract_id?: string | null;
              offer_details?: unknown;
            }>;
            application_review_items?: Array<{
              item_type: string;
              item_id: string;
              status: string;
            }>;
          },
          reviewerUserId,
          logContext
        );
        nextApp = await repository.getApplicationById(applicationId);
      }
    }

    if (isAcceptanceDoc) {
      const acceptancePhaseAfter = this.getPrimaryOfferAcceptanceStatus(
        nextApp ?? application
      );
      if (shouldNotifyAcceptanceDocumentChanges(acceptancePhaseBefore, acceptancePhaseAfter)) {
        try {
          const submittedAt =
            this.getPrimaryOfferAcceptanceSubmittedAt(nextApp ?? application) ?? "none";
          await this.sendIssuerNotification(
            applicationId,
            NotificationTypeIds.ACCEPTANCE_DOCUMENT_CHANGES_REQUESTED,
            { applicationId },
            // One notify per acceptance submit cycle when first entering CHANGES_REQUESTED.
            `acceptance-changes-entered:${submittedAt}`,
            { platformOnly: true, ensureTypesSeeded: true }
          );
        } catch (notificationError) {
          logger.error(
            { error: notificationError, applicationId, itemId },
            "Failed to send acceptance document change notification to issuer"
          );
        }
      } else {
        logger.info(
          {
            applicationId,
            itemId,
            acceptancePhaseBefore,
            acceptancePhaseAfter,
          },
          "Skipped acceptance change notification (already in CHANGES_REQUESTED or phase unchanged)"
        );
      }
    }

    if (itemType === "invoice" && nextApp) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Add or update a pending amendment (draft). Updates section/item status immediately and
   * creates ApplicationReviewRemark with submitted_at=null. Proceed sets submitted_at.
   */
  async addPendingAmendment(
    applicationId: string,
    scope: "section" | "item",
    scopeKey: string,
    remark: string,
    reviewerUserId: string,
    itemType?: "invoice" | "document",
    itemId?: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );

    if (isAcceptanceDocumentsAmendmentQueueScope(scope, scopeKey)) {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Acceptance document changes use Request change (immediate), not the underwriting amendment queue"
      );
    }

    if (scope === "section") {
      const validSections = REVIEW_SECTION_ORDER;
      if (!validSections.includes(scopeKey as (typeof REVIEW_SECTION_ORDER)[number])) {
        throw new AppError(400, "INVALID_SCOPE", `Invalid section: ${scopeKey}`);
      }
      if (scopeKey === "supporting_documents") {
        throw new AppError(
          400,
          "INVALID_ACTION",
          "Documents section status is derived from per-document reviews; add drafts on document items instead"
        );
      }
      if (scopeKey === "contract_details") {
        this.ensureContractOfferActionAllowed(application);
      }
      if (scopeKey === "invoice_details") {
        await this.ensureInvoiceSectionActionAllowed(applicationId);
      }
      await repository.updateSectionReviewStatus(
        applicationId,
        scopeKey as ReviewSection,
        ReviewStepStatus.AMENDMENT_REQUESTED,
        reviewerUserId
      );
      if (scopeKey === "contract_details" && application.contract_id) {
        await prisma.contract.update({
          where: { id: application.contract_id },
          data: { status: "AMENDMENT_REQUESTED" },
        });
      }
    } else {
      if (!itemType || !itemId) {
        throw new AppError(400, "INVALID_INPUT", "itemType and itemId are required for item scope");
      }
      this.validateReviewItemExists(application, itemType, itemId);
      if (itemType === "invoice") {
        await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
      }
      if (itemType === "invoice") {
        const targetInvoiceId = this.resolveInvoiceIdFromScopeKey(application, itemId);
        if (targetInvoiceId) {
          const existingDrafts = await repository.listPendingAmendments(applicationId);
          for (const draft of existingDrafts) {
            if (draft.scope !== "item" || draft.scope_key === itemId) continue;
            const draftInvoiceId = this.resolveInvoiceIdFromScopeKey(application, draft.scope_key);
            if (draftInvoiceId && draftInvoiceId === targetInvoiceId) {
              await repository.removeDraftAmendment(applicationId, "item", draft.scope_key);
            }
          }
        }
      }
      await repository.upsertItemReviewStatus(
        applicationId,
        itemType,
        itemId,
        ReviewStepStatus.AMENDMENT_REQUESTED,
        reviewerUserId
      );
      if (itemType === "invoice") {
        const invoiceId = this.resolveInvoiceIdFromScopeKey(
          application as { invoices?: { id: string; details?: { number?: string | number } }[] },
          itemId
        );
        if (invoiceId) {
          await prisma.invoice.update({
            where: { id: invoiceId, application_id: applicationId },
            data: { status: "AMENDMENT_REQUESTED" },
          });
        }
        if (application.contract_id) {
          await this.refreshContractFacilityValues(application.contract_id);
        }
      }
    }

    await repository.upsertDraftAmendment(applicationId, scope, scopeKey, remark, reviewerUserId);

    logger.info({ applicationId, scope, scopeKey, reviewerUserId }, "Pending amendment added");
    let result = await repository.getApplicationById(applicationId);
    if (scope === "item" && itemType === "document" && result) {
      await this.syncDocumentDerivedSectionsFromItems(
        repository,
        applicationId,
        result,
        reviewerUserId,
        logContext
      );
      result = await repository.getApplicationById(applicationId);
    }
    if (scope === "item" && itemType === "invoice" && result) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        result,
        reviewerUserId,
        logContext
      );
      result = await repository.getApplicationById(applicationId);
    }
    return result ?? repository.getApplicationById(applicationId);
  }

  /**
   * List pending amendments for an application (draft remarks with submitted_at=null)
   */
  async listPendingAmendments(applicationId: string) {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    if (!this.isReviewable(application.status as ApplicationStatus)) {
      throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
    }
    const rows = await repository.listPendingAmendments(applicationId);
    const dedupedRows = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      // Keep one pending amendment per invoice, even if historical scope_key index changed.
      if (row.scope === "item" && row.scope_key.startsWith("invoice_details:")) {
        const invoiceId = this.resolveInvoiceIdFromScopeKey(
          application as { invoices?: { id: string; details?: { number?: string | number } }[] },
          row.scope_key
        );
        if (invoiceId) {
          dedupedRows.set(`invoice:${invoiceId}`, row);
          continue;
        }
      }
      dedupedRows.set(`scope:${row.scope}:${row.scope_key}`, row);
    }
    const normalizedRows = Array.from(dedupedRows.values());
    return normalizedRows.map((r) => {
      const base = {
        id: r.id,
        scope: r.scope,
        scope_key: r.scope_key,
        remark: r.remark,
        author: r.author ? { first_name: r.author.first_name, last_name: r.author.last_name } : undefined,
      };
      if (r.scope === "item") {
        const { itemType, itemId } = parseItemScopeKey(r.scope_key);
        return { ...base, item_type: itemType || null, item_id: itemId || null };
      }
      return { ...base, item_type: null, item_id: null };
    });
  }

  /**
   * Update a pending amendment remark
   */
  async updatePendingAmendment(
    applicationId: string,
    scope: string,
    scopeKey: string,
    remark: string,
    reviewerUserId: string
  ) {
    const { repository } = await this.prepareForReviewAction(applicationId);
    const result = await repository.updateDraftAmendment(
      applicationId,
      scope,
      scopeKey,
      remark,
      reviewerUserId
    );
    if (result.count === 0) {
      throw new AppError(404, "NOT_FOUND", "Pending amendment not found");
    }
    logger.info({ applicationId, scope, scopeKey }, "Pending amendment updated");
    return repository.listPendingAmendments(applicationId);
  }

  /**
   * Remove a pending amendment. If the affected section has no pending amendments left,
   * reverts the section status to PENDING.
   */
  async removePendingAmendment(
    applicationId: string,
    scope: string,
    scopeKey: string,
    reviewerUserId: string
  ) {
    const { repository } = await this.prepareForReviewAction(applicationId);
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    const affectedSection =
      scope === "section"
        ? scopeKey
        : getSectionForScopeKey(scopeKey);
    if (affectedSection === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (affectedSection === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }
    if (scope === "item") {
      const { itemType, itemId } = parseItemScopeKey(scopeKey);
      if (itemType === "invoice") {
        await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
      }
    }

    const result = await repository.removeDraftAmendment(applicationId, scope, scopeKey);
    if (result.count === 0) {
      throw new AppError(404, "NOT_FOUND", "Pending amendment not found");
    }
    logger.info({ applicationId, scope, scopeKey }, "Pending amendment removed");

    if (scope === "item") {
      const { itemType, itemId } = parseItemScopeKey(scopeKey);
      await repository.upsertItemReviewStatus(
        applicationId,
        itemType,
        itemId,
        ReviewStepStatus.PENDING,
        reviewerUserId
      );
      if (itemType === "invoice") {
        const application = await repository.getApplicationById(applicationId);
        const invoiceId = application
          ? this.resolveInvoiceIdFromScopeKey(
              application as { invoices?: { id: string; details?: { number?: string | number } }[] },
              itemId
            )
          : null;
        if (invoiceId) {
          await prisma.invoice.update({
            where: { id: invoiceId, application_id: applicationId },
            data: { status: "SUBMITTED" },
          });
          await repository.updateApplicationStatus(applicationId, ApplicationStatus.INVOICE_PENDING);
          if (application?.contract_id) {
            await this.refreshContractFacilityValues(application.contract_id);
          }
        }
      }
    }

    const remaining = await repository.listPendingAmendments(applicationId);
    const sectionStillHasAmendments = remaining.some((p) => {
      const s = getSectionForPendingAmendment(p.scope, p.scope_key);
      return s === affectedSection;
    });

    if (!sectionStillHasAmendments) {
      const validSections = REVIEW_SECTION_ORDER;
      if (validSections.includes(affectedSection as (typeof REVIEW_SECTION_ORDER)[number])) {
        await repository.updateSectionReviewStatus(
          applicationId,
          affectedSection as ReviewSection,
          ReviewStepStatus.PENDING,
          reviewerUserId
        );
      }
      if (affectedSection === "contract_details") {
        if (application.contract_id) {
          await prisma.contract.update({
            where: { id: application.contract_id },
            data: { status: "SUBMITTED" },
          });
          const structure = application.financing_structure as { structure_type?: string } | null | undefined;
          const isInvoiceOnly = structure?.structure_type === "invoice_only";
          await repository.updateApplicationStatus(
            applicationId,
            isInvoiceOnly ? ApplicationStatus.UNDER_REVIEW : ApplicationStatus.CONTRACT_PENDING
          );
        }
      }
    }

    if (affectedSection === "invoice_details") {
      const nextApp = await repository.getApplicationById(applicationId);
      if (nextApp) {
        await this.syncInvoiceDetailsSectionFromItems(
          repository,
          applicationId,
          nextApp,
          reviewerUserId,
          undefined
        );
      }
    }

    return repository.listPendingAmendments(applicationId);
  }

  /**
   * Submit all pending amendments. Marks draft remarks as submitted and updates application status.
   * Item/section status already set when adding to pending; remarks already exist.
   */
  async submitPendingAmendments(applicationId: string, reviewerUserId: string, logContext?: AdminLogContext) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application,
      reviewerUserId,
      logContext
    );

    const pending = await repository.listPendingAmendments(applicationId);
    if (pending.length === 0) {
      throw new AppError(400, "EMPTY_LIST", "No pending amendments to submit");
    }

    const hasContractDetails = pending.some(
      (p) => p.scope === "section" && p.scope_key === "contract_details"
    );

    await prisma.$transaction(async (tx) => {
      await tx.applicationReviewRemark.updateMany({
        where: {
          application_id: applicationId,
          review_cycle: application.review_cycle,
          action_type: "REQUEST_AMENDMENT",
          submitted_at: null,
        },
        data: { submitted_at: new Date() },
      });

      if (hasContractDetails && application.contract_id) {
        await tx.contract.update({
          where: { id: application.contract_id },
          data: { status: "AMENDMENT_REQUESTED" },
        });
      }

      await tx.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.AMENDMENT_REQUESTED },
      });

      const affectedSections = [
        ...new Set(pending.map((p) => getSectionForPendingAmendment(p.scope, p.scope_key))),
      ];
      await writeApplicationAuditLog(
        {
          eventType: "APPLICATION_AMENDMENTS_REQUESTED",
          context: adminApplicationAuditContext(reviewerUserId, {
            ipAddress: logContext?.ipAddress,
            userAgent: logContext?.userAgent,
          }),
          applicationId,
          targetType: APPLICATION_AUDIT_TARGET_TYPE.APPLICATION,
          targetId: applicationId,
          metadata: {
            reviewCycle: application.review_cycle,
            count: pending.length,
            affectedSections,
          },
        },
        tx
      );
    });

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.APPLICATION_AMENDMENTS_REQUESTED,
        {
          applicationId,
          amendmentCount: pending.length,
        },
        `amendments-submitted:${application.review_cycle ?? 1}:${pending.length}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId },
        "Failed to send amendment submitted notification to issuer"
      );
    }

    logger.info({ applicationId, count: pending.length, reviewerUserId }, "Pending amendments submitted");
    return repository.getApplicationById(applicationId);
  }
}
