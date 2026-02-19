import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateApplicationLogData {
  userId: string;
  applicationId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class ApplicationLogRepository {
  async create(data: CreateApplicationLogData) {
    return (prisma as any).applicationLog.create({
      data: {
        user_id: data.userId,
        application_id: data.applicationId ?? null,
        event_type: data.eventType,
        ip_address: data.ipAddress ?? null,
        user_agent: data.userAgent ?? null,
        device_info: data.deviceInfo ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }
}

export const applicationLogRepository = new ApplicationLogRepository();

