import type { QueryClient } from "@tanstack/react-query";
import { applicationsKeys } from "@/applications/query-keys";

/**
 * After application mutations, refresh list queries, sidebar nav, and product lists
 * (sidebar groups use both products + applications).
 */
export function invalidateAdminApplicationNavQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
  void queryClient.invalidateQueries({ queryKey: applicationsKeys.sidebarAll });
  void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
}

/**
 * Targeted invalidation for the open application detail (and optional action-count badge).
 * Prefer this over nav spray for section/item review mutations.
 */
export function invalidateAdminApplicationDetailQueries(
  queryClient: QueryClient,
  applicationId: string,
  options?: { includeActionCount?: boolean }
): void {
  void queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(applicationId) });
  if (options?.includeActionCount) {
    void queryClient.invalidateQueries({ queryKey: applicationsKeys.actionCount });
  }
}
