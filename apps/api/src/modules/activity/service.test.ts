import { activityService } from "./service";
import { auditLogAggregator } from "./aggregator";

jest.mock("./aggregator");

describe("ActivityService", () => {
  const userId = "user1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getActivities", () => {
    it("should return paginated activities from aggregator", async () => {
      const mockResult = {
        activities: [
          {
            id: "1",
            user_id: userId,
            category: "security",
            event_type: "LOGIN",
            activity: "Logged in",
            created_at: new Date(),
            source_table: "security_logs",
          },
        ],
        total: 1,
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
      expect(result.activities[0].activity).toBe("Logged in");
    });

    it("should handle aggregator errors gracefully", async () => {
      (auditLogAggregator.aggregate as jest.Mock).mockRejectedValue(new Error("Aggregator failed"));

      const query = { page: 1, limit: 10 };
      const result = await activityService.getActivities(userId, query as any);

      expect(result.activities).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });
});
