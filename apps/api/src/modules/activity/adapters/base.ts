import { Prisma } from "@prisma/client";
import type { ActivityDomain, ActivityReferences } from "@cashsouk/types";

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
  domain: ActivityDomain;
  event_type: string; // Raw event type from audit log (displayed as "Event" in UI)
  activity: string; // Backward-compatible alias for title
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: string | null;
  created_at: Date; // Displayed as "Time" in UI
  source_table: string; // For debugging (e.g., "security_logs")
  references?: ActivityReferences | null;
}

/**
 * Query filters for activities
 */
export interface ActivityFilters {
  search?: string;
  categories?: ActivityCategory[];
  domains?: ActivityDomain[];
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
  readonly domain: ActivityDomain;

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

  buildPresentation(eventType: string, metadata?: Record<string, unknown>): {
    title: string;
    description: string;
  };

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
