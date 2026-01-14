import { auditLogAggregator } from "./aggregator";
import { GetActivitiesQuery } from "./schemas";
import { logger } from "../../lib/logger";
import { ActivityCategory } from "./adapters/base";

export const activityService = {
  /**
   * Get paginated activities for a user aggregated from multiple audit logs
   */
  async getActivities(userId: string, query: GetActivitiesQuery) {
    try {
      const { page, limit, search, categories, eventTypes, startDate, endDate } = query;
      const offset = (page - 1) * limit;

      const result = await auditLogAggregator.aggregate(userId, {
        search,
        categories: categories as ActivityCategory[],
        event_types: eventTypes,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit,
        offset,
      });

      return {
        activities: result.activities,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get aggregated activities", { error, userId, query });
      return {
        activities: [],
        pagination: {
          total: 0,
          page: query.page,
          limit: query.limit,
          pages: 0,
        },
      };
    }
  },
};
