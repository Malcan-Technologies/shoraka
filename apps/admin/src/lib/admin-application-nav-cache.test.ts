import type { QueryClient } from "@tanstack/react-query";
import { applicationsKeys } from "@/applications/query-keys";
import { invalidateAdminApplicationDetailQueries } from "./admin-application-nav-cache";

describe("invalidateAdminApplicationDetailQueries", () => {
  it("refreshes sidebar/dashboard nav counts when action badges change", () => {
    const invalidateQueries = jest.fn();
    invalidateAdminApplicationDetailQueries(
      { invalidateQueries } as unknown as QueryClient,
      "app-1",
      { includeActionCount: true }
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: applicationsKeys.detail("app-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: applicationsKeys.actionCount,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: applicationsKeys.navCounts,
    });
  });
});
