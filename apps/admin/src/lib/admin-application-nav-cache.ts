import type { QueryClient } from "@tanstack/react-query";
import { applicationsKeys } from "@/applications/query-keys";

/**
 * After application mutations, refresh list queries, sidebar/dashboard nav counts, and product lists.
 */
export function invalidateAdminApplicationNavQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
  void queryClient.invalidateQueries({ queryKey: applicationsKeys.navCounts });
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
    void queryClient.invalidateQueries({ queryKey: applicationsKeys.navCounts });
  }
}
