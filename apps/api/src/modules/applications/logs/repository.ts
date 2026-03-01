import { prisma } from "../../../lib/prisma";
import { CreateApplicationLogParams } from "./types";

export async function createApplicationLog(params: CreateApplicationLogParams) {
  return prisma.applicationLog.create({
    data: {
      user_id: params.userId,
      application_id: params.applicationId ?? null,
      event_type: `${params.level ?? ""}_${params.target ?? ""}_${params.action ?? ""}`,
      level: params.level ?? null,
      target: params.target ?? null,
      action: params.action ?? null,
      review_cycle: params.reviewCycle ?? null,
      remark: params.remark ?? null,
      entity_id: params.entityId ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      device_info: params.deviceInfo ?? null,
    },
  });
}

