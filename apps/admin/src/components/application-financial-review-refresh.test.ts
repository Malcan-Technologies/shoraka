jest.mock("@cashsouk/config", () => ({ useAuthToken: jest.fn() }));

import { QueryClient } from "@tanstack/react-query";
import { applicationsKeys } from "@/applications/query-keys";
import { applicationLogsKeys } from "@/hooks/use-application-logs";
import { invalidateFinancialReviewAfterSave } from "./application-financial-review-refresh";

describe("invalidateFinancialReviewAfterSave", () => {
  it("invalidates the application detail and its Activity Timeline logs only", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(applicationsKeys.detail("app-1"), {});
    queryClient.setQueryData(applicationLogsKeys.list("app-1"), { items: [] });
    queryClient.setQueryData(applicationLogsKeys.list("app-2"), { items: [] });

    invalidateFinancialReviewAfterSave(queryClient, "app-1");

    const cache = queryClient.getQueryCache();
    expect(cache.find({ queryKey: applicationsKeys.detail("app-1") })?.state.isInvalidated).toBe(true);
    expect(cache.find({ queryKey: applicationLogsKeys.list("app-1") })?.state.isInvalidated).toBe(true);
    expect(cache.find({ queryKey: applicationLogsKeys.list("app-2") })?.state.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
