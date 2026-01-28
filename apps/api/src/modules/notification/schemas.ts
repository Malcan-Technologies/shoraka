import { z } from 'zod';
import { NotificationCategory, NotificationPriority } from '@prisma/client';

export const CreateNotificationSchema = z.object({
  userId: z.string(),
  typeId: z.string(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  title: z.string(),
  message: z.string(),
  linkPath: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().optional(),
});

export const NotificationFiltersSchema = z.object({
  read: z.string().transform(v => v === 'true').optional(),
  category: z.nativeEnum(NotificationCategory).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  startDate: z.string().datetime().transform(v => new Date(v)).optional(),
  endDate: z.string().datetime().transform(v => new Date(v)).optional(),
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 15),
  offset: z.string().optional().transform(v => v ? parseInt(v, 10) : 0),
});

export const UpdatePreferenceSchema = z.object({
  enabled_platform: z.boolean(),
  enabled_email: z.boolean(),
});

export const UpdateNotificationTypeSchema = z.object({
  enabled_platform: z.boolean().optional(),
  enabled_email: z.boolean().optional(),
  user_configurable: z.boolean().optional(),
  default_priority: z.nativeEnum(NotificationPriority).optional(),
  retention_days: z.number().int().min(0).nullable().optional(),
});

export enum NotificationTargetType {
  ALL_USERS = 'ALL_USERS',
  INVESTORS = 'INVESTORS',
  ISSUERS = 'ISSUERS',
  SPECIFIC_USERS = 'SPECIFIC_USERS',
  GROUP = 'GROUP',
}

export const AdminSendNotificationSchema = z.object({
  targetType: z.nativeEnum(NotificationTargetType),
  userIds: z.array(z.string()).optional(),
  groupId: z.string().optional(),
  typeId: z.string(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  title: z.string(),
  message: z.string(),
  linkPath: z.string().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(data => {
  if (data.targetType === NotificationTargetType.SPECIFIC_USERS && (!data.userIds || data.userIds.length === 0)) {
    return false;
  }
  if (data.targetType === NotificationTargetType.GROUP && !data.groupId) {
    return false;
  }
  return true;
}, {
  message: "User IDs are required for SPECIFIC_USERS, and Group ID is required for GROUP",
  path: ["userIds", "groupId"],
});

export const CreateNotificationGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  userIds: z.array(z.string()).min(1),
});

export const UpdateNotificationGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  userIds: z.array(z.string()).min(1).optional(),
});
