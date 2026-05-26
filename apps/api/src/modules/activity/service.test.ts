const mockGetOrganization = jest.fn();

jest.mock("../organization/service", () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({
    getOrganization: mockGetOrganization,
  })),
}));

import { activityService } from "./service";
import { auditLogAggregator } from "./aggregator";
import { AppError } from "../../lib/http/error-handler";

jest.mock("./aggregator");

describe("ActivityService", () => {
  const userId = "user1";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrganization.mockReset();
  });

  describe("getActivities", () => {
    it("should return paginated activities from aggregator", async () => {
      const mockResult = {
        activities: [
          {
            id: "1",
            user_id: userId,
            category: "organization",
            domain: "application",
            event_type: "APPLICATION_SUBMITTED",
            activity: "Application Submitted",
            title: "Application Submitted",
            description: "Your financing application was submitted and is now under review.",
            references: {
              applicationId: "app_123",
            },
            created_at: new Date(),
            source_table: "application_logs",
          },
        ],
        total: 1,
        unfilteredTotal: 1,
      };

      (auditLogAggregator.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const query = { page: 1, limit: 10 };
      const result = await activityService.getActivities(userId, query as any);

      expect(auditLogAggregator.aggregate).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          limit: 10,
          offset: 0,
        })
      );
      expect(result.activities).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.activities[0].activity).toBe("Application Submitted");
      expect(result.activities[0].references).toEqual({ applicationId: "app_123" });
    });

    it("should handle aggregator errors gracefully", async () => {
      (auditLogAggregator.aggregate as jest.Mock).mockRejectedValue(new Error("Aggregator failed"));

      const query = { page: 1, limit: 10 };
      const result = await activityService.getActivities(userId, query as any);

      expect(result.activities).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it("should verify organization access before aggregating organization-scoped activity", async () => {
      (auditLogAggregator.aggregate as jest.Mock).mockResolvedValue({
        activities: [],
        total: 0,
        unfilteredTotal: 0,
      });
      mockGetOrganization.mockResolvedValue({ id: "org_1" });

      await activityService.getActivities(userId, {
        page: 1,
        limit: 10,
        organizationId: "org_1",
        portalType: "investor",
      } as any);

      expect(mockGetOrganization).toHaveBeenCalledWith(userId, "org_1", "investor");
      expect(auditLogAggregator.aggregate).toHaveBeenCalled();
    });

    it("should rethrow authorization errors from organization access checks", async () => {
      const error = new AppError(403, "FORBIDDEN", "You do not have access to this organization");
      mockGetOrganization.mockRejectedValue(error);

      await expect(
        activityService.getActivities(userId, {
          page: 1,
          limit: 10,
          organizationId: "org_1",
          portalType: "issuer",
        } as any)
      ).rejects.toBe(error);

      expect(auditLogAggregator.aggregate).not.toHaveBeenCalled();
    });
  });
});
