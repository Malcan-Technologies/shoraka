import { Request } from "express";
import { ActivityType } from "@prisma/client";
import { activityService } from "../modules/activity/service";
import { logger } from "./logger";

/**
 * Utility to log user activities with request context
 */
export const activityLogger = {
  /**
   * Log an activity for a user, automatically extracting request metadata
   */
  async log(
    req: Request | null,
    userId: string,
    type: ActivityType,
    options?: {
      title?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    try {
      // Extract request metadata if request object is provided
      const ip_address = req?.ip || req?.socket?.remoteAddress || undefined;
      const user_agent = req?.headers?.["user-agent"] || undefined;

      // Basic device info extraction from user agent
      let device_info = undefined;
      if (user_agent) {
        if (user_agent.includes("Mobile")) {
          device_info = "Mobile";
        } else if (user_agent.includes("Tablet")) {
          device_info = "Tablet";
        } else {
          device_info = "Desktop";
        }
      }

      const title = options?.title || activityService.buildActivityTitle(type, options?.metadata);

      await activityService.logActivity({
        user_id: userId,
        activity_type: type,
        title,
        description: options?.description,
        metadata: options?.metadata,
        ip_address,
        user_agent,
        device_info,
      });
    } catch (error) {
      // We don't want logging failures to crash the application
      logger.error("ActivityLogger.log failed", { error, userId, type });
    }
  },
};
