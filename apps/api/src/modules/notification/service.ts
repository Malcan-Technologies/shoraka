import {
  Notification,
  NotificationCategory,
  NotificationLogSource,
  Prisma,
  NotificationType,
  NotificationPortalTarget,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
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
import {
  isNotificationLogUniqueConflict,
  notificationLogTargetToPortal,
  portalToNotificationLogTarget,
  summarizeNotificationDelivery,
  systemNotificationLogKey,
  type NotificationDeliveryResult,
  type SystemDeliveryLogInput,
} from "./delivery-log";

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
    const { notification } = await this.createInternal(params);
    return notification;
  }

  private async createInternal(
    params: CreateNotificationParams
  ): Promise<{ notification: Notification | null; replayed: boolean }> {
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
        return { notification: existing, replayed: true };
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

    // AUTHENTICATION types always deliver on both channels.
    const forceAuthenticationDelivery = type.category === NotificationCategory.AUTHENTICATION;

    // Manual overrides or derived from type/preferences
    const shouldDeliverPlatform = forceAuthenticationDelivery
      ? true
      : sendToPlatform !== undefined
        ? sendToPlatform
        : type.enabled_platform &&
          (type.user_configurable ? (userPref?.enabled_platform ?? true) : true);

    const shouldDeliverEmail = forceAuthenticationDelivery
      ? true
      : sendToEmail !== undefined
        ? sendToEmail
        : type.enabled_email && (type.user_configurable ? (userPref?.enabled_email ?? true) : true);

    // Safety: If both channels are disabled, skip notification creation
    if (!shouldDeliverPlatform && !shouldDeliverEmail) {
      logger.info(
        { userId, typeId },
        "Notification skipped: both platform and email channels are disabled"
      );
      return { notification: null, replayed: false };
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

    return { notification, replayed: false };
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
    const { notification } = await this.sendTypedInternal(userId, typeId, payload, idempotencyKey);
    return notification;
  }

  /**
   * Single-recipient send plus one SYSTEM delivery-history row.
   * The notification idempotency key is required so the SYSTEM log key is stable.
   */
  async sendTypedAndLogSystem<T extends NotificationTypeId>(
    userId: string,
    typeId: T,
    payload: NotificationPayloads[T],
    idempotencyKey: string,
    options?: { targetType?: string }
  ): Promise<Notification | null> {
    try {
      const { notification, title, message, portal } = await this.sendTypedInternal(
        userId,
        typeId,
        payload,
        idempotencyKey
      );
      await this.logSystemDelivery({
        typeId,
        title,
        message,
        targetType: options?.targetType ?? portalToNotificationLogTarget(portal),
        recipientCount: 1,
        results: [notification],
        idempotencyKey: systemNotificationLogKey(typeId, idempotencyKey),
        metadata: payload as Record<string, unknown>,
      });
      return notification;
    } catch (error) {
      try {
        const content = getNotificationContent(typeId, payload);
        await this.logSystemDelivery({
          typeId,
          title: content.title,
          message: content.message,
          targetType: options?.targetType ?? portalToNotificationLogTarget(content.portal),
          recipientCount: 1,
          results: [null],
          idempotencyKey: systemNotificationLogKey(typeId, idempotencyKey),
          metadata: payload as Record<string, unknown>,
        });
      } catch {
        // Secondary log/content failure must not hide the original send error.
      }
      throw error;
    }
  }

  private async sendTypedInternal<T extends NotificationTypeId>(
    userId: string,
    typeId: T,
    payload: NotificationPayloads[T],
    idempotencyKey?: string
  ): Promise<{
    notification: Notification | null;
    replayed: boolean;
    title: string;
    message: string;
    portal: string | undefined;
  }> {
    const { title, message, linkPath, portal } = getNotificationContent(typeId, payload);
    const { notification, replayed } = await this.createInternal({
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
    return { notification, replayed, title, message, portal };
  }

  /**
   * One SYSTEM row per logical send batch. Never throws — log failure must not
   * fail the business operation.
   */
  async logSystemDelivery(input: SystemDeliveryLogInput): Promise<void> {
    try {
      const { deliveredPlatformCount, deliveredEmailCount } = summarizeNotificationDelivery(
        input.results
      );
      await prisma.notificationLog.create({
        data: {
          source: NotificationLogSource.SYSTEM,
          target_type: input.targetType,
          notification_type_id: input.typeId,
          title: input.title,
          message: input.message,
          recipient_count: input.recipientCount,
          delivered_platform_count: deliveredPlatformCount,
          delivered_email_count: deliveredEmailCount,
          idempotency_key: input.idempotencyKey,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isNotificationLogUniqueConflict(error)) {
        return;
      }
      logger.error(
        { error, typeId: input.typeId, recipientCount: input.recipientCount },
        "Failed to write system notification delivery log"
      );
    }
  }

  /**
   * Shared batch logger: title/message from the typed template, counts from results.
   */
  async logTypedSystemBatch<T extends NotificationTypeId>(
    typeId: T,
    payload: NotificationPayloads[T],
    results: NotificationDeliveryResult[],
    options: {
      idempotencyKey: string;
      metadata?: Record<string, unknown>;
      targetType?: string;
    }
  ): Promise<void> {
    if (results.length === 0) return;
    const { title, message, portal } = getNotificationContent(typeId, payload);
    await this.logSystemDelivery({
      typeId,
      title,
      message,
      targetType: options.targetType ?? portalToNotificationLogTarget(portal),
      recipientCount: results.length,
      results,
      idempotencyKey: options.idempotencyKey,
      metadata: options.metadata ?? (payload as Record<string, unknown>),
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
    const type = await this.repository.findTypeById(id);
    if (!type) {
      throw new AppError(404, "NOTIFICATION_TYPE_NOT_FOUND", `Notification type ${id} not found`);
    }

    if (
      type.category === NotificationCategory.AUTHENTICATION &&
      (data.enabled_platform === false || data.enabled_email === false)
    ) {
      throw new AppError(
        400,
        "AUTHENTICATION_NOTIFICATION_REQUIRED",
        "Authentication notifications must keep platform and email delivery enabled"
      );
    }

    return this.repository.updateType(id, data);
  }

  /**
   * Add any catalog types that are missing. Does not change existing toggles.
   * Used on first send of a type so delivery is not blocked.
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
    logger.info({ count, added }, "Notification types seeded");
    return { count, added };
  }

  /**
   * Add missing catalog types and turn Platform + Email on for every catalog type.
   */
  async resetNotificationTypesToDefault(): Promise<{
    count: number;
    added: number;
    reset: number;
  }> {
    let added = 0;
    let reset = 0;
    for (const type of initialNotificationTypes) {
      const created = await this.repository.createTypeIfNotExist(type);
      if (created) {
        added++;
        continue;
      }
      await this.repository.updateType(type.id, {
        enabled_platform: true,
        enabled_email: true,
      });
      reset++;
    }
    const count = initialNotificationTypes.length;
    logger.info({ count, added, reset }, "Notification types reset to default channels");
    return { count, added, reset };
  }

  /**
   * Admin: Get all notification logs
   */
  async getAdminLogs(
    filters: {
      limit?: number;
      offset?: number;
      search?: string;
      type?: string;
      target?: string;
      source?: string;
    } = {}
  ) {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const { search, type, target, source } = filters;

    const where: Prisma.NotificationLogWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { admin: { first_name: { contains: search, mode: "insensitive" } } },
                { admin: { last_name: { contains: search, mode: "insensitive" } } },
                { admin: { email: { contains: search, mode: "insensitive" } } },
                { title: { contains: search, mode: "insensitive" } },
                { message: { contains: search, mode: "insensitive" } },
                { notification_type_id: { contains: search, mode: "insensitive" } },
                { notification_type: { name: { contains: search, mode: "insensitive" } } },
                // Handle combined name search (e.g. "John Doe")
                ...(search.includes(" ")
                  ? [
                      {
                        admin: {
                          AND: [
                            {
                              first_name: {
                                contains: search.split(" ")[0],
                                mode: "insensitive" as Prisma.QueryMode,
                              },
                            },
                            {
                              last_name: {
                                contains: search.split(" ").slice(1).join(" "),
                                mode: "insensitive" as Prisma.QueryMode,
                              },
                            },
                          ],
                        },
                      },
                    ]
                  : []),
              ],
            }
          : {},
        type && type !== "all" ? { notification_type_id: type } : {},
        target && target !== "all" ? { target_type: target } : {},
        source && source !== "all" ? { source: source as NotificationLogSource } : {},
      ],
    };

    const [items, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        include: {
          admin: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          notification_type: true,
        },
        orderBy: {
          created_at: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      },
    };
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
   * Admin: Send notification to multiple users
   */
  async sendBulkNotification(
    adminUserId: string,
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
      ip_address?: string;
      user_agent?: string;
      device_info?: string;
    }
  ) {
    let type = await this.repository.findTypeById(params.typeId);
    if (!type) {
      await this.seedNotificationTypes();
      type = await this.repository.findTypeById(params.typeId);
    }
    if (!type) {
      throw new AppError(
        400,
        "NOTIFICATION_TYPE_NOT_FOUND",
        `Notification type ${params.typeId} not found`
      );
    }

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

    const portal = notificationLogTargetToPortal(params.targetType);
    const metadata = {
      ...(params.metadata || {}),
      ...(portal ? { portal } : {}),
    };

    const results = [];
    const deliveryResults: NotificationDeliveryResult[] = [];
    for (const userId of targetUserIds) {
      try {
        const result = await this.create({
          userId,
          typeId: params.typeId,
          priority: params.priority,
          title: params.title,
          message: params.message,
          linkPath: params.linkPath,
          metadata,
          sendToPlatform: params.sendToPlatform,
          sendToEmail: params.sendToEmail,
          expiresAt: params.expiresAt,
        });

        if (result) {
          results.push({ userId, success: true, id: result.id });
          deliveryResults.push(result);
        } else {
          results.push({
            userId,
            success: false,
            error: "Notification skipped: no delivery channels enabled",
          });
          deliveryResults.push(null);
        }
      } catch (error) {
        logger.error(
          { error, userId, typeId: params.typeId },
          "Failed to send bulk notification to user"
        );
        results.push({
          userId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        deliveryResults.push(null);
      }
    }

    const { deliveredPlatformCount, deliveredEmailCount } =
      summarizeNotificationDelivery(deliveryResults);

    try {
      await prisma.notificationLog.create({
        data: {
          admin_user_id: adminUserId,
          source: NotificationLogSource.ADMIN,
          target_type: params.targetType,
          target_group_id: params.groupId,
          notification_type_id: params.typeId,
          title: params.title,
          message: params.message,
          recipient_count: targetUserIds.length,
          delivered_platform_count: deliveredPlatformCount,
          delivered_email_count: deliveredEmailCount,
          idempotency_key: null,
          metadata: metadata as Prisma.InputJsonValue,
          ip_address: params.ip_address,
          user_agent: params.user_agent,
          device_info: params.device_info,
        },
      });
    } catch (error) {
      logger.error(
        { error, adminUserId, typeId: params.typeId, recipientCount: targetUserIds.length },
        "Failed to write admin notification delivery log"
      );
    }

    return results;
  }

  /**
   * Cleanup task
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
