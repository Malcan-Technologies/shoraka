import type { AdminPermission, DashboardStatsSections } from "@cashsouk/types";

/**
 * Maps the caller's dashboard.* permissions to the sections GET /admin/dashboard/stats
 * may return. `can` is the request's permission check (Super Admin resolves to true).
 */
export function resolveDashboardStatsSections(
  can: (permission: AdminPermission) => boolean
): DashboardStatsSections {
  return {
    platform: can("dashboard.platform.view"),
    operations: can("dashboard.operations.view"),
    finance: can("dashboard.finance.view"),
    reports: can("dashboard.reports.view"),
  };
}
