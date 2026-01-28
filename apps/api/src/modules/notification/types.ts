import {
  Notification,
  NotificationType,
  NotificationCategory,
  NotificationPriority,
} from '@prisma/client';

export type NotificationWithDetails = Notification & {
  notification_type: NotificationType;
};

export interface CreateNotificationParams {
  userId: string;
  typeId: string;
  priority?: NotificationPriority;
  title: string;
  message: string;
  linkPath?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface NotificationFilters {
  read?: boolean;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface PaginatedNotifications {
  items: NotificationWithDetails[];
  pagination: {
    total: number;
    unreadCount: number;
    limit: number;
    offset: number;
    pages: number;
  };
}
