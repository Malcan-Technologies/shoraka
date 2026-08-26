import type { GetAdminApplicationsParams } from "@cashsouk/types";

export const applicationsKeys = {
  all: ["admin", "applications"] as const,
  navCounts: ["admin", "applications", "nav-counts"] as const,
  actionCount: ["admin", "applications", "action-count"] as const,
  list: (params: GetAdminApplicationsParams) =>
    [...applicationsKeys.all, "list", params.productId ?? "all", params] as const,
  detail: (applicationId: string) =>
    [...applicationsKeys.all, "detail", applicationId] as const,
};
