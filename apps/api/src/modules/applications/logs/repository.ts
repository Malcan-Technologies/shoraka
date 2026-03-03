import { prisma } from "../../../lib/prisma";
import { CreateApplicationLogParams } from "./types";

export async function createApplicationLog(params: CreateApplicationLogParams) {
  const eventType =
    params.eventType ??
    `${params.level ?? ""}_${params.target ?? ""}_${params.action ?? ""}`;

  return prisma.applicationLog.create({
    data: {
      user_id: params.userId,
      application_id: params.applicationId ?? null,
      event_type: eventType,
      level: params.level ?? null,
      target: params.target ?? null,
      action: params.action ?? null,
      review_cycle: params.reviewCycle ?? null,
      remark: params.remark ?? null,
      entity_id: params.entityId ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      device_info: params.deviceInfo ?? null,
      portal: params.portal ?? null,
      metadata: params.metadata ?? null,
    } as any,
  });
}

