import { Notification, Prisma, NotificationType } from "@prisma/client";
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

export class NotificationService {
  private repository: NotificationRepository;
  private groupRepository: NotificationGroupRepository;

  constructor() {
    this.repository = new NotificationRepository();
    this.groupRepository = new NotificationGroupRepository();
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
    const type = await this.repository.findTypeById(typeId);
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
    const [items, total] = await this.repository.findManyByUserId(userId, filters);
    const unreadCount = await this.repository.countUnread(userId);

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
    return this.repository.countUnread(userId);
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
    const allTypes = await prisma.notificationType.findMany();
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
   * Admin: Get all notification logs
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
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const { search, type, target } = filters;

    const where: Prisma.NotificationLogWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { admin: { first_name: { contains: search, mode: "insensitive" } } },
                { admin: { last_name: { contains: search, mode: "insensitive" } } },
                { admin: { email: { contains: search, mode: "insensitive" } } },
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

    const results = [];
    for (const userId of targetUserIds) {
      try {
        const result = await this.create({
          ...params,
          userId,
        });

        if (result) {
          results.push({ userId, success: true, id: result.id });
        } else {
          results.push({
            userId,
            success: false,
            error: "Notification skipped: no delivery channels enabled",
          });
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
      }
    }

    // Log the admin action
    await prisma.notificationLog.create({
      data: {
        admin_user_id: adminUserId,
        target_type: params.targetType,
        target_group_id: params.groupId,
        notification_type_id: params.typeId,
        title: params.title,
        message: params.message,
        recipient_count: targetUserIds.length,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
        ip_address: params.ip_address,
        user_agent: params.user_agent,
        device_info: params.device_info,
      },
    });

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
