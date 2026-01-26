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
  limit: z.string().transform(v => parseInt(v, 10)).default('20'),
  offset: z.string().transform(v => parseInt(v, 10)).default('0'),
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

export const AdminSendNotificationSchema = z.object({
  userIds: z.array(z.string()).min(1),
  typeId: z.string(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  title: z.string(),
  message: z.string(),
  linkPath: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
