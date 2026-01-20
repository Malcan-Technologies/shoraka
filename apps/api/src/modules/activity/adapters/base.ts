import { Prisma } from "@prisma/client";

/**
 * Activity category - maps to audit log source
 */
export type ActivityCategory = "organization";

/**
 * Unified activity structure returned to frontend
 */
export interface UnifiedActivity {
  id: string;
  user_id: string;
  category: ActivityCategory;
  event_type: string; // Raw event type from audit log (displayed as "Event" in UI)
  activity: string; // Human-readable description (displayed as "Activity" in UI)
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: string | null;
  created_at: Date; // Displayed as "Time" in UI
  source_table: string; // For debugging (e.g., "security_logs")
}

/**
 * Query filters for activities
 */
export interface ActivityFilters {
  search?: string;
  categories?: ActivityCategory[];
  event_types?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  organizationId?: string;
  portalType?: "investor" | "issuer";
}

/**
 * Base adapter interface that all audit log adapters must implement
 *
 * Each adapter transforms a specific audit log table into unified activities
 */
export interface AuditLogAdapter<T> {
  /**
   * Adapter name (for debugging/logging)
   */
  readonly name: string;

  /**
   * Activity category this adapter handles
   */
  readonly category: ActivityCategory;

  /**
   * Query audit logs for a specific user with filters
   */
  query(userId: string, filters: ActivityFilters): Promise<T[]>;

  /**
   * Count total audit logs for a specific user with filters
   */
  count(userId: string, filters: ActivityFilters): Promise<number>;

  /**
   * Transform a single audit log record into a unified activity
   */
  transform(record: T): UnifiedActivity;

  /**
   * Build human-readable activity description from event type and metadata
   * This is where adapter-specific logic for creating contextual descriptions lives
   */
  buildDescription(
    eventType: string,
    metadata?: Record<string, unknown>
  ): string;

  /**
   * Get list of event types this adapter handles
   * Used for filtering and validation
   */
  getEventTypes(): string[];
}

/**
 * Helper to build Prisma where clause for date range filtering
 */
export function buildDateFilter(
  startDate?: Date,
  endDate?: Date
): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  const filter: Prisma.DateTimeFilter = {};

  if (startDate) {
    filter.gte = startDate;
  }

  if (endDate) {
    filter.lte = endDate;
  }

  return filter;
}
