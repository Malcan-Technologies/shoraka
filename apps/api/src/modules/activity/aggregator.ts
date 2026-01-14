import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
} from "./adapters/base";
import { SecurityLogAdapter } from "./adapters/security-log";
import { OnboardingLogAdapter } from "./adapters/onboarding-log";
import { DocumentLogAdapter } from "./adapters/document-log";

export class AuditLogAggregator {
  private adapters: AuditLogAdapter<any>[] = [];

  constructor() {
    // Register default adapters
    this.registerAdapter(new SecurityLogAdapter());
    this.registerAdapter(new OnboardingLogAdapter());
    this.registerAdapter(new DocumentLogAdapter());
  }

  /**
   * Register a new audit log adapter
   */
  registerAdapter(adapter: AuditLogAdapter<any>) {
    this.adapters.push(adapter);
  }

  /**
   * Aggregate activities from all registered adapters with filtering and pagination
   */
  async aggregate(
    userId: string,
    filters: ActivityFilters
  ): Promise<{ activities: UnifiedActivity[]; total: number }> {
    const { categories, limit = 10, offset = 0 } = filters;

    // Filter adapters by category if specified
    const activeAdapters = categories && categories.length > 0
      ? this.adapters.filter((a) => categories.includes(a.category))
      : this.adapters;

    // For runtime aggregation with pagination across multiple tables:
    // To get the correct sorted slice (offset, limit), we need to fetch
    // enough items from each source to cover the potential window.
    // Given these are user-specific logs (relatively low volume),
    // we fetch (offset + limit) from each source.
    const fetchLimit = offset + limit;

    const results = await Promise.all(
      activeAdapters.map(async (adapter) => {
        try {
          const records = await adapter.query(userId, {
            ...filters,
            limit: fetchLimit,
            offset: 0, // We always fetch from the start to ensure merge sort works
          });
          return records.map((r) => adapter.transform(r));
        } catch (error) {
          // Log error but don't fail the whole request
          console.error(`Aggregator: ${adapter.name} failed`, error);
          return [];
        }
      })
    );

    // Merge and sort all results by created_at DESC
    const allActivities = results
      .flat()
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    // Apply pagination slice
    const paginatedActivities = allActivities.slice(offset, offset + limit);

    // Note: This 'total' is an approximation of the filtered set across all tables
    // In a real high-volume scenario, we would use more complex cursor-based
    // pagination or separate count queries. For a user activity feed, this is fine.
    return {
      activities: paginatedActivities,
      total: allActivities.length,
    };
  }

  /**
   * Get all supported event types across all adapters
   */
  getAllEventTypes(): string[] {
    return this.adapters.flatMap((a) => a.getEventTypes());
  }
}

// Export a singleton instance
export const auditLogAggregator = new AuditLogAggregator();
