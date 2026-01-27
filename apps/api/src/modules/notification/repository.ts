import { prisma } from "../../lib/prisma";
import {
  Notification,
  NotificationType,
  UserNotificationPreference,
  Prisma,
} from "@prisma/client";
import { NotificationFilters, NotificationWithDetails } from "./types";

export class NotificationRepository {
  /**
   * Create a new notification
   */
  async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return prisma.notification.create({
      data,
    });
  }

  /**
   * Find notification by idempotency key
   */
  async findByIdempotencyKey(key: string): Promise<Notification | null> {
    return prisma.notification.findUnique({
      where: { idempotency_key: key },
    });
  }

  /**
   * Find notification by ID
   */
  async findById(id: string): Promise<NotificationWithDetails | null> {
    return prisma.notification.findUnique({
      where: { id },
      include: {
        notification_type: true,
      },
    });
  }

  /**
   * Get paginated notifications for a user
   */
  async findManyByUserId(userId: string, filters: NotificationFilters): Promise<[NotificationWithDetails[], number]> {
    const baseWhere: Prisma.NotificationWhereInput = {
      user_id: userId,
      send_to_platform: true,
      ...(filters.category && { notification_type: { category: filters.category } }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.startDate && filters.endDate && {
        created_at: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      }),
      OR: [
        { expires_at: null },
        { expires_at: { gt: new Date() } },
      ],
    };

    // If filter specifically asks for read/unread, use simple prisma query
    if (filters.read !== undefined) {
      const where = { ...baseWhere, read_at: filters.read ? { not: null } : null };
      const [items, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: { notification_type: true },
          orderBy: { created_at: 'desc' },
          take: filters.limit,
          skip: filters.offset,
        }),
        prisma.notification.count({ where }),
      ]);
      return [items as NotificationWithDetails[], total];
    }

    // Default view: Unread first, then Read, both sorted by created_at desc
    const unreadWhere = { ...baseWhere, read_at: null };
    const readWhere = { ...baseWhere, read_at: { not: null } };

    const [unreadCount, totalCount] = await Promise.all([
      prisma.notification.count({ where: unreadWhere }),
      prisma.notification.count({ where: baseWhere }),
    ]);

    let items: Notification[] = [];
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 20;

    if (offset < unreadCount) {
      // 1. Fetch unread notifications
      items = await prisma.notification.findMany({
        where: unreadWhere,
        include: { notification_type: true },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      });

      // 2. If we need more to fill the limit, fetch read notifications
      if (items.length < limit) {
        const readItems = await prisma.notification.findMany({
          where: readWhere,
          include: { notification_type: true },
          orderBy: { created_at: 'desc' },
          skip: 0,
          take: limit - items.length,
        });
        items = [...items, ...readItems];
      }
    } else {
      // 3. Offset is beyond unread notifications, fetch only read ones
      items = await prisma.notification.findMany({
        where: readWhere,
        include: { notification_type: true },
        orderBy: { created_at: 'desc' },
        skip: offset - unreadCount,
        take: limit,
      });
    }

    return [items as NotificationWithDetails[], totalCount];
  }

  /**
   * Get unread count for a user
   */
  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        user_id: userId,
        send_to_platform: true,
        read_at: null,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id, user_id: userId },
      data: { read_at: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
    return prisma.notification.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
  }

  /**
   * Get all notification types
   */
  async findAllTypes(): Promise<NotificationType[]> {
    return prisma.notificationType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update notification type
   */
  async updateType(id: string, data: Prisma.NotificationTypeUpdateInput): Promise<NotificationType> {
    return prisma.notificationType.update({
      where: { id },
      data,
    });
  }

  /**
   * Get notification type by ID
   */
  async findTypeById(id: string): Promise<NotificationType | null> {
    return prisma.notificationType.findUnique({
      where: { id },
    });
  }

  /**
   * Get user preferences for all notification types
   */
  async findUserPreferences(userId: string): Promise<UserNotificationPreference[]> {
    return prisma.userNotificationPreference.findMany({
      where: { user_id: userId },
    });
  }

  /**
   * Upsert user preference for a notification type
   */
  async upsertUserPreference(
    userId: string,
    typeId: string,
    data: { enabled_platform: boolean; enabled_email: boolean }
  ): Promise<UserNotificationPreference> {
    return prisma.userNotificationPreference.upsert({
      where: {
        user_id_notification_type_id: {
          user_id: userId,
          notification_type_id: typeId,
        },
      },
      create: {
        user_id: userId,
        notification_type_id: typeId,
        ...data,
      },
      update: data,
    });
  }

  /**
   * Delete expired notifications
   */
  async deleteExpired(): Promise<Prisma.BatchPayload> {
    return prisma.notification.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    });
  }

  /**
   * Delete old notifications based on retention days
   */
  async deleteOldNotifications(typeId: string, retentionDays: number): Promise<Prisma.BatchPayload> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return prisma.notification.deleteMany({
      where: {
        notification_type_id: typeId,
        created_at: { lt: cutoffDate },
      },
    });
  }
}
