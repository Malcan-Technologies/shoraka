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
