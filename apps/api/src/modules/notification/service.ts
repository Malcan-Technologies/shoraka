import {
  Notification,
  Prisma,
  NotificationType,
  NotificationPortalTarget,
} from "@prisma/client";
import { NotificationRepository } from "./repository";
import { NotificationGroupRepository } from "./group-repository";
import { CreateNotificationParams, NotificationFilters, PaginatedNotifications } from "./types";
import { buildNotificationEmail } from "./email-templates";
import { sendEmail } from "../../lib/email/ses-client";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { getNotificationContent, NotificationPayloads, NotificationTypeId } from "./registry";
import { getFullUrl, PortalType } from "../../lib/http/url-utils";
import { PortalContext } from "../../lib/http/portal-context";
import { initialNotificationTypes } from "./seed-data";
import type { NotificationBroadcastAuditContext } from "./audit/context";
import { writeNotificationBroadcastProcessedAudit } from "./audit/writer";
import { notificationBroadcastAuditLogReader } from "./audit/reader";
import { NOTIFICATION_BROADCAST_CHANNEL_MODE } from "./audit/events";

export class NotificationService {
  private repository: NotificationRepository;
  private groupRepository: NotificationGroupRepository;

  constructor() {
    this.repository = new NotificationRepository();
    this.groupRepository = new NotificationGroupRepository();
  }

  private getCurrentPortalTarget(): NotificationPortalTarget | undefined {
    const portal = PortalContext.get();
    if (portal === "investor") return NotificationPortalTarget.INVESTOR;
    if (portal === "issuer") return NotificationPortalTarget.ISSUER;
    return undefined;
  }

  /**
   * Create a notification and handle delivery (platform + email)
   */
  async create(params: CreateNotificationParams): Promise<Notification | null> {
    const {
      userId,
      typeId,
      priority,
      title,
      message,
      linkPath,
      metadata,
      idempotencyKey,
      sendToPlatform,
      sendToEmail,
      expiresAt: manualExpiresAt,
    } = params;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        logger.info({ idempotencyKey, userId }, "Notification already exists (idempotency hit)");
        return existing;
      }
    }

    // 2. Get Notification Type
    let type = await this.repository.findTypeById(typeId);
    if (!type) {
      logger.info({ typeId }, "Notification type missing; seeding notification types");
      await this.seedNotificationTypes();
      type = await this.repository.findTypeById(typeId);
    }
    if (!type) {
      throw new Error(`Notification type ${typeId} not found`);
    }

    // 3. Resolve Preferences
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const preferences = await this.repository.findUserPreferences(userId);
    const userPref = preferences.find((p) => p.notification_type_id === typeId);

    // Manual overrides or derived from type/preferences
    const shouldDeliverPlatform =
      sendToPlatform !== undefined
        ? sendToPlatform
        : type.enabled_platform &&
          (type.user_configurable ? (userPref?.enabled_platform ?? true) : true);

    const shouldDeliverEmail =
      sendToEmail !== undefined
        ? sendToEmail
        : type.enabled_email && (type.user_configurable ? (userPref?.enabled_email ?? true) : true);

    // Safety: If both channels are disabled, skip notification creation
    if (!shouldDeliverPlatform && !shouldDeliverEmail) {
      logger.info(
        { userId, typeId },
        "Notification skipped: both platform and email channels are disabled"
      );
      return null;
    }

    // 4. Create Notification Record
    const finalPriority = priority || type.default_priority;

    // Resolve expiration: Manual override > Type-defined retention > Default 30 days
    let expiresAt: Date | null = null;
    if (manualExpiresAt) {
      expiresAt = manualExpiresAt;
    } else if (type.retention_days) {
      expiresAt = new Date(Date.now() + type.retention_days * 24 * 60 * 60 * 1000);
    } else {
      // Default 30 days expiration if not specified
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const notification = await this.repository.create({
      user: { connect: { user_id: userId } },
      notification_type: { connect: { id: typeId } },
      priority: finalPriority,
      title,
      message,
      link_path: linkPath,
      metadata: metadata as Prisma.InputJsonValue,
      idempotency_key: idempotencyKey,
      expires_at: expiresAt,
      send_to_platform: shouldDeliverPlatform,
      send_to_email: shouldDeliverEmail,
    });

    // 5. Immediate Email Delivery
    if (shouldDeliverEmail) {
      try {
        const emailOptions = buildNotificationEmail(notification, user);
        await sendEmail(emailOptions);

        // Update email_sent_at
        await prisma.notification.update({
          where: { id: notification.id },
          data: { email_sent_at: new Date() },
        });
      } catch (error) {
        logger.error(
          { error, notificationId: notification.id },
          "Failed to send notification email"
        );
      }
    }

    return notification;
  }

  /**
   * Get paginated notifications for a user
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters
  ): Promise<PaginatedNotifications> {
    const portalTarget = this.getCurrentPortalTarget();
    const scopedFilters = {
      ...filters,
      portalTarget,
    };
    const [items, total] = await this.repository.findManyByUserId(userId, scopedFilters);
    const unreadCount = await this.repository.countUnreadByPortal(userId, portalTarget);

    const currentPortal = PortalContext.get();

    // Transform links to absolute URLs if they belong to a different portal
    const transformedItems = items.map((item) => {
      const metadata = item.metadata as any;
      const targetPortal = metadata?.portal as PortalType;

      if (targetPortal && targetPortal !== currentPortal && item.link_path) {
        return {
          ...item,
          link_path: getFullUrl(item.link_path, targetPortal),
        };
      }
      return item;
    });

    const limit = filters.limit || 15;
    const offset = filters.offset || 0;

    return {
      items: transformedItems,
      pagination: {
        total,
        unreadCount,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread count for badge
   */
  async getUnreadCount(userId: string): Promise<number> {
    const portalTarget = this.getCurrentPortalTarget();
    return this.repository.countUnreadByPortal(userId, portalTarget);
  }

  /**
   * Send a notification using the typed registry
   */
  async sendTyped<T extends NotificationTypeId>(
    userId: string,
    typeId: T,
    payload: NotificationPayloads[T],
    idempotencyKey?: string
  ): Promise<Notification | null> {
    const { title, message, linkPath, portal } = getNotificationContent(typeId, payload);

    return this.create({
      userId,
      typeId,
      title,
      message,
      linkPath,
      idempotencyKey,
      metadata: {
        ...(payload as Record<string, any>),
        portal,
      },
    });
  }

  /**
   * Platform inbox only — email channel suppressed (for phased rollout).
   */
  async sendTypedPlatformOnly<T extends NotificationTypeId>(
    userId: string,
    typeId: T,
    payload: NotificationPayloads[T],
    idempotencyKey?: string
  ): Promise<Notification | null> {
    const { title, message, linkPath, portal } = getNotificationContent(typeId, payload);

    return this.create({
      userId,
      typeId,
      title,
      message,
      linkPath,
      idempotencyKey,
      sendToPlatform: true,
      sendToEmail: false,
      metadata: {
        ...(payload as Record<string, any>),
        portal,
      },
    });
  }

  /**
   * Mark as read
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    return this.repository.markAsRead(id, userId);
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.repository.markAllAsRead(userId);
    return result.count;
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string) {
    const portalTarget = this.getCurrentPortalTarget();
    const allTypes = await prisma.notificationType.findMany({
      where: portalTarget
        ? {
            portal_targets: {
              has: portalTarget,
            },
          }
        : undefined,
    });
    const userPrefs = await this.repository.findUserPreferences(userId);

    return allTypes.map((type) => {
      const pref = userPrefs.find((p) => p.notification_type_id === type.id);
      return {
        ...type,
        enabled_platform: type.user_configurable
          ? (pref?.enabled_platform ?? type.enabled_platform)
          : type.enabled_platform,
        enabled_email: type.user_configurable
          ? (pref?.enabled_email ?? type.enabled_email)
          : type.enabled_email,
      };
    });
  }

  /**
   * Update user preference
   */
  async updateUserPreference(
    userId: string,
    typeId: string,
    data: { enabled_platform: boolean; enabled_email: boolean }
  ) {
    const type = await this.repository.findTypeById(typeId);
    if (!type) {
      throw new Error(`Notification type ${typeId} not found`);
    }

    if (!type.user_configurable) {
      throw new Error(`Notification type ${typeId} is not user configurable`);
    }

    return this.repository.upsertUserPreference(userId, typeId, data);
  }

  /**
   * Admin: Get all notification types
   */
  async getAllNotificationTypes(): Promise<NotificationType[]> {
    return this.repository.findAllTypes();
  }

  /**
   * Admin: Update notification type
   */
  async updateNotificationType(
    id: string,
    data: Partial<NotificationType>
  ): Promise<NotificationType> {
    return this.repository.updateType(id, data);
  }

  /**
   * Admin: Seed notification types
   */
  async seedNotificationTypes(): Promise<{ count: number; added: number }> {
    let count = 0;
    let added = 0;
    for (const type of initialNotificationTypes) {
      const result = await this.repository.createTypeIfNotExist(type);
      if (result) {
        added++;
      }
      count++;
    }
    logger.info({ count, added }, "Notification types seeded via Admin API");
    return { count, added };
  }

  /**
   * Admin: Get notification broadcast audit logs
   */
  async getAdminLogs(
    filters: {
      limit?: number;
      offset?: number;
      search?: string;
      type?: string;
      target?: string;
    } = {}
  ) {
    return notificationBroadcastAuditLogReader.list(filters);
  }

  /**
   * Admin: Create notification group
   */
  async createNotificationGroup(data: { name: string; description?: string; userIds: string[] }) {
    return this.groupRepository.create({
      name: data.name,
      description: data.description,
      user_ids: data.userIds,
    });
  }

  /**
   * Admin: Get all notification groups
   */
  async getAllNotificationGroups() {
    return this.groupRepository.findAll();
  }

  /**
   * Admin: Update notification group
   */
  async updateNotificationGroup(
    id: string,
    data: { name?: string; description?: string; userIds?: string[] }
  ) {
    return this.groupRepository.update(id, {
      name: data.name,
      description: data.description,
      user_ids: data.userIds,
    });
  }

  /**
   * Admin: Delete notification group
   */
  async deleteNotificationGroup(id: string) {
    return this.groupRepository.delete(id);
  }

  /**
   * Admin: Send notification to multiple users.
   *
   * Recipient Notification rows and SES sends are processed one-by-one outside a
   * bulk transaction. After that loop, one NotificationBroadcastAuditLog row is
   * written. If that audit insert fails, already-created Notification rows are
   * left in place (no rollback of inbox/delivery).
   */
  async sendBulkNotification(
    context: NotificationBroadcastAuditContext,
    params: {
      targetType: string;
      userIds?: string[];
      groupId?: string;
      typeId: string;
      priority?: any;
      title: string;
      message: string;
      linkPath?: string;
      metadata?: any;
      sendToPlatform?: boolean;
      sendToEmail?: boolean;
      expiresAt?: Date;
    }
  ) {
    let targetUserIds: string[] = [];

    if (params.targetType === "ALL_USERS") {
      const users = await prisma.user.findMany({ select: { user_id: true } });
      targetUserIds = users.map((u) => u.user_id);
    } else if (params.targetType === "INVESTORS") {
      const users = await prisma.user.findMany({
        where: { roles: { has: "INVESTOR" } },
        select: { user_id: true },
      });
      targetUserIds = users.map((u) => u.user_id);
    } else if (params.targetType === "ISSUERS") {
      const users = await prisma.user.findMany({
        where: { roles: { has: "ISSUER" } },
        select: { user_id: true },
      });
      targetUserIds = users.map((u) => u.user_id);
    } else if (params.targetType === "SPECIFIC_USERS") {
      targetUserIds = params.userIds || [];
    } else if (params.targetType === "GROUP" && params.groupId) {
      const group = await this.groupRepository.findById(params.groupId);
      if (group) {
        targetUserIds = group.user_ids;
      }
    }

    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const userId of targetUserIds) {
      try {
        const result = await this.create({
          ...params,
          userId,
        });

        if (result) {
          createdCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        logger.error(
          { error, userId, typeId: params.typeId },
          "Failed to send bulk notification to user"
        );
      }
    }

    const targetedCount = targetUserIds.length;
    const type = await this.repository.findTypeById(params.typeId);
    const explicitOverride =
      params.sendToPlatform !== undefined || params.sendToEmail !== undefined;

    await writeNotificationBroadcastProcessedAudit({
      eventType: "NOTIFICATION_BROADCAST_PROCESSED",
      context,
      audienceType: params.targetType,
      notificationTypeId: params.typeId,
      metadata: {
        notificationTypeId: params.typeId,
        notificationTypeName: type?.name ?? params.typeId,
        portalTargets: (type?.portal_targets ?? []) as Array<"INVESTOR" | "ISSUER">,
        audienceType: params.targetType,
        groupId: params.groupId ?? null,
        targetedCount,
        createdCount,
        skippedCount,
        failedCount,
        title: params.title,
        message: params.message,
        channelMode: explicitOverride
          ? NOTIFICATION_BROADCAST_CHANNEL_MODE.EXPLICIT_OVERRIDE
          : NOTIFICATION_BROADCAST_CHANNEL_MODE.TYPE_AND_USER_PREFERENCES,
        sendToPlatform: explicitOverride ? (params.sendToPlatform ?? null) : null,
        sendToEmail: explicitOverride ? (params.sendToEmail ?? null) : null,
        linkPath: params.linkPath ?? null,
        expiresAt: params.expiresAt ? params.expiresAt.toISOString() : null,
      },
    });

    return {
      targetedCount,
      createdCount,
      skippedCount,
      failedCount,
    };
  }

  /**
   * Cleanup task. Deletes expired/old Notification inbox rows only.
   * Must never delete NotificationBroadcastAuditLog (or legacy NotificationLog).
   */
  async runCleanup() {
    logger.info("Running notification cleanup...");

    // 1. Delete expired
    const expiredResult = await this.repository.deleteExpired();
    logger.info({ count: expiredResult.count }, "Deleted expired notifications");

    // 2. Delete old based on retention_days
    const typesWithRetention = await prisma.notificationType.findMany({
      where: { retention_days: { not: null } },
    });

    for (const type of typesWithRetention) {
      if (type.retention_days) {
        const oldResult = await this.repository.deleteOldNotifications(
          type.id,
          type.retention_days
        );
        if (oldResult.count > 0) {
          logger.info(
            { typeId: type.id, count: oldResult.count },
            "Deleted old notifications for type"
          );
        }
      }
    }
  }
}
