import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
} from "./adapters/base";
import { OrganizationLogAdapter } from "./adapters/organization-log";
import { ApplicationLogAdapter } from "./adapters/application-log";
import { NoteLogAdapter } from "./adapters/note-log";
import { SigningLogAdapter } from "./adapters/signing-log";
import { PaymentLogAdapter } from "./adapters/payment-log";

export class AuditLogAggregator {
  private adapters: AuditLogAdapter<any>[] = [];

  constructor() {
    // Register default adapters
    this.registerAdapter(new OrganizationLogAdapter());
    this.registerAdapter(new ApplicationLogAdapter());
    this.registerAdapter(new NoteLogAdapter());
    this.registerAdapter(new SigningLogAdapter());
    this.registerAdapter(new PaymentLogAdapter());
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
  ): Promise<{ activities: UnifiedActivity[]; total: number; unfilteredTotal: number }> {
    const { categories, domains, limit = 10, offset = 0 } = filters;

    const activeAdapters = this.adapters.filter((adapter) => {
      if (
        filters.portalType === "investor" &&
        (adapter.domain === "application" || adapter.domain === "signing")
      ) {
        return false;
      }

      if (filters.portalType === "issuer" && adapter.domain === "payment") {
        return false;
      }

      const matchesCategory = !categories || categories.length === 0 || categories.includes(adapter.category);
      const matchesDomain = !domains || domains.length === 0 || domains.includes(adapter.domain);
      return matchesCategory && matchesDomain;
    });

    // Adapters already return only visible rows. Fetching the merged window
    // (offset + limit) from each source is enough for a correct k-way merge
    // as long as each adapter is newest-first. Expand the window only when an
    // adapter saturates its page and the merged set is still short.
    const MAX_ADAPTER_FETCH = 500;
    let fetchLimit = Math.min(MAX_ADAPTER_FETCH, offset + limit);
    let allActivities: UnifiedActivity[] = [];

    while (true) {
      const results = await Promise.all(
        activeAdapters.map(async (adapter) => {
          try {
            const records = await adapter.query(userId, {
              ...filters,
              limit: fetchLimit,
              offset: 0,
            });
            return records.map((r) => adapter.transform(r, filters));
          } catch (error) {
            console.error(`Aggregator: ${adapter.name} failed`, error);
            return [];
          }
        })
      );

      allActivities = results.flat().sort((a, b) => {
        const byTime = b.created_at.getTime() - a.created_at.getTime();
        if (byTime !== 0) return byTime;
        return b.id.localeCompare(a.id);
      });

      const saturated = results.some((rows) => rows.length >= fetchLimit);
      if (
        allActivities.length >= offset + limit ||
        !saturated ||
        fetchLimit >= MAX_ADAPTER_FETCH
      ) {
        break;
      }
      fetchLimit = Math.min(MAX_ADAPTER_FETCH, fetchLimit * 2);
    }

    // Apply pagination slice
    const paginatedActivities = allActivities.slice(offset, offset + limit);

    // Get the actual total count across all active adapters
    const counts = await Promise.all(
      activeAdapters.map((adapter) => adapter.count(userId, filters))
    );
    const totalCount = counts.reduce((acc, count) => acc + count, 0);

    // Get the unfiltered total count (only user_id/organization filter and categories filter)
    const unfilteredCounts = await Promise.all(
      activeAdapters.map((adapter) =>
        adapter.count(userId, {
          categories,
          domains,
          organizationId: filters.organizationId,
          portalType: filters.portalType,
        })
      )
    );
    const unfilteredTotalCount = unfilteredCounts.reduce((acc, count) => acc + count, 0);

    return {
      activities: paginatedActivities,
      total: totalCount,
      unfilteredTotal: unfilteredTotalCount,
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
