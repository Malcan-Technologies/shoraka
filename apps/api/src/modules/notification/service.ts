import { Notification, Prisma, NotificationType } from '@prisma/client';
import { NotificationRepository } from './repository';
import { CreateNotificationParams, NotificationFilters, PaginatedNotifications } from './types';
import { buildNotificationEmail } from './email-templates';
import { sendEmail } from '../../lib/email/ses-client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

export class NotificationService {
  private repository: NotificationRepository;

  constructor() {
    this.repository = new NotificationRepository();
  }

  /**
   * Create a notification and handle delivery (platform + email)
   */
  async create(params: CreateNotificationParams): Promise<Notification> {
    const { userId, typeId, priority, title, message, linkPath, metadata, idempotencyKey } = params;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        logger.info({ idempotencyKey, userId }, 'Notification already exists (idempotency hit)');
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
    const userPref = preferences.find(p => p.notification_type_id === typeId);

    const shouldDeliverPlatform = type.enabled_platform && (type.user_configurable ? (userPref?.enabled_platform ?? true) : true);
    const shouldDeliverEmail = type.enabled_email && (type.user_configurable ? (userPref?.enabled_email ?? true) : true);

    // 4. Create Notification Record
    const finalPriority = priority || type.default_priority;
    const expiresAt = type.retention_days ? new Date(Date.now() + type.retention_days * 24 * 60 * 60 * 1000) : null;

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
        logger.error({ error, notificationId: notification.id }, 'Failed to send notification email');
      }
    }

    return notification;
  }

  /**
   * Get paginated notifications for a user
   */
  async getUserNotifications(userId: string, filters: NotificationFilters): Promise<PaginatedNotifications> {
    const [items, total] = await this.repository.findManyByUserId(userId, filters);
    const unreadCount = await this.repository.countUnread(userId);

    return {
      items,
      total,
      unreadCount,
    };
  }

  /**
   * Get unread count for badge
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
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

    return allTypes.map(type => {
      const pref = userPrefs.find(p => p.notification_type_id === type.id);
      return {
        ...type,
        enabled_platform: type.user_configurable ? (pref?.enabled_platform ?? type.enabled_platform) : type.enabled_platform,
        enabled_email: type.user_configurable ? (pref?.enabled_email ?? type.enabled_email) : type.enabled_email,
      };
    });
  }

  /**
   * Update user preference
   */
  async updateUserPreference(userId: string, typeId: string, data: { enabled_platform: boolean; enabled_email: boolean }) {
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
  async updateNotificationType(id: string, data: Partial<NotificationType>): Promise<NotificationType> {
    return this.repository.updateType(id, data);
  }

  /**
   * Admin: Send notification to multiple users
   */
  async sendBulkNotification(params: {
    userIds: string[];
    typeId: string;
    priority?: any;
    title: string;
    message: string;
    linkPath?: string;
    metadata?: any;
  }) {
    const results = [];
    for (const userId of params.userIds) {
      try {
        const result = await this.create({
          ...params,
          userId,
        });
        results.push({ userId, success: true, id: result.id });
      } catch (error) {
        logger.error({ error, userId, typeId: params.typeId }, 'Failed to send bulk notification to user');
        results.push({ userId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return results;
  }

  /**
   * Cleanup task
   */
  async runCleanup() {
    logger.info('Running notification cleanup...');

    // 1. Delete expired
    const expiredResult = await this.repository.deleteExpired();
    logger.info({ count: expiredResult.count }, 'Deleted expired notifications');

    // 2. Delete old based on retention_days
    const typesWithRetention = await prisma.notificationType.findMany({
      where: { retention_days: { not: null } },
    });

    for (const type of typesWithRetention) {
      if (type.retention_days) {
        const oldResult = await this.repository.deleteOldNotifications(type.id, type.retention_days);
        if (oldResult.count > 0) {
          logger.info({ typeId: type.id, count: oldResult.count }, 'Deleted old notifications for type');
        }
      }
    }
  }
}
