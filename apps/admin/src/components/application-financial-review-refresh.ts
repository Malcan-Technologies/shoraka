import type { QueryClient } from "@tanstack/react-query";
import { applicationsKeys } from "@/applications/query-keys";
import { applicationLogsKeys } from "@/hooks/use-application-logs";

/**
 * After an admin Financial save (add FY, edit statement, edit field), refresh the
 * application detail and the Activity Timeline logs, same as review item/section actions.
 */
export function invalidateFinancialReviewAfterSave(
  queryClient: QueryClient,
  applicationId: string
): void {
  void queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(applicationId) });
  void queryClient.invalidateQueries({ queryKey: applicationLogsKeys.list(applicationId) });
}
