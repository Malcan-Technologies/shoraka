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
      const { page, limit, search, categories, eventType, eventTypes, startDate, endDate, dateRange } = query;
      const offset = (page - 1) * limit;

      let finalStartDate = startDate ? new Date(startDate) : undefined;
      const finalEndDate = endDate ? new Date(endDate) : undefined;

      // Handle dateRange if provided and startDate/endDate are not
      if (dateRange && dateRange !== "all" && !startDate) {
        const now = new Date();
        switch (dateRange) {
          case "24h":
            finalStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "7d":
            finalStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "30d":
            finalStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      // Combine single eventType and eventTypes array
      const combinedEventTypes = [...(eventTypes || [])];
      if (eventType && !combinedEventTypes.includes(eventType)) {
        combinedEventTypes.push(eventType);
      }

      const result = await auditLogAggregator.aggregate(userId, {
        search,
        categories: categories as ActivityCategory[],
        event_types: combinedEventTypes.length > 0 ? combinedEventTypes : undefined,
        startDate: finalStartDate,
        endDate: finalEndDate,
        limit,
        offset,
        organizationId: query.organizationId,
        portalType: query.portalType,
      });

      return {
        activities: result.activities,
        pagination: {
          total: result.total,
          unfilteredTotal: result.unfilteredTotal,
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
          unfilteredTotal: 0,
          page: query.page,
          limit: query.limit,
          pages: 0,
        },
      };
    }
  },
};
