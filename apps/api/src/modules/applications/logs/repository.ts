/**
 * Guide: docs/guides/admin/activity-timeline.md — Application log creation, remark at top-level, metadata usage
 */

import { prisma } from "../../../lib/prisma";
import { CreateApplicationLogParams } from "./types";

export async function createApplicationLog(params: CreateApplicationLogParams) {
  return prisma.applicationLog.create({
    data: {
      user_id: params.userId,
      application_id: params.applicationId ?? null,
      event_type: params.eventType,
      level: null,
      target: null,
      action: null,
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

