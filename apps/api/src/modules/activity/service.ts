import { ActivityType } from "@prisma/client";
import { activityRepository } from "./repository";
import { CreateActivityInput, GetActivitiesQuery } from "./schemas";
import { logger } from "../../lib/logger";

export const activityService = {
  /**
   * Get paginated activities for a user
   */
  async getActivities(userId: string, query: GetActivitiesQuery) {
    const result = await activityRepository.findActivities(userId, query);

    return {
      activities: result.activities,
      pagination: {
        total: result.total,
        page: query.page,
        limit: query.limit,
        pages: result.pages,
      },
    };
  },

  /**
   * Log a new activity
   */
  async logActivity(data: CreateActivityInput) {
    try {
      const activity = await activityRepository.createActivity(data);
      return activity;
    } catch (error) {
      logger.error("Failed to log activity", { error, data });
      // We don't throw here to avoid breaking the main flow if logging fails
      return null;
    }
  },

  /**
   * Helper to build a human-readable title based on activity type and metadata
   */
  buildActivityTitle(type: ActivityType, metadata?: unknown): string {
    const meta = metadata as Record<string, unknown> | undefined;
    switch (type) {
      case ActivityType.LOGIN:
        return "Logged in";
      case ActivityType.LOGOUT:
        return "Logged out";
      case ActivityType.LOGIN_FAILED:
        return "Failed login attempt";
      case ActivityType.NEW_DEVICE_LOGIN:
        return "New device logged";
      case ActivityType.PASSWORD_CHANGED:
        return "Password changed";
      case ActivityType.EMAIL_VERIFIED:
        return "Email verified";
      case ActivityType.SECURITY_ALERT:
        return "Security alert";
      case ActivityType.PROFILE_UPDATED:
        return "Profile update";
      case ActivityType.SETTINGS_CHANGED:
        return "Settings changed";
      case ActivityType.DEPOSIT:
        return `RM${meta?.amount || ""} Deposit`;
      case ActivityType.WITHDRAWAL:
        return `RM${meta?.amount || ""} Withdrawal`;
      case ActivityType.INVESTMENT:
        return `RM${meta?.amount || ""} Investment`;
      case ActivityType.TRANSACTION_COMPLETED:
        return "Transaction completed";
      case ActivityType.ONBOARDING_STARTED:
        return "Onboarding started";
      case ActivityType.ONBOARDING_COMPLETED:
        return "Onboarding completed";
      case ActivityType.KYC_SUBMITTED:
        return "KYC submitted";
      default:
        return "Activity recorded";
    }
  },
};
