import { activityService } from "./service";
import { activityRepository } from "./repository";
import { ActivityType } from "@prisma/client";
import { CreateActivityInput } from "./schemas";

jest.mock("./repository");

describe("ActivityService", () => {
  const userId = "user1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getActivities", () => {
    it("should return paginated activities", async () => {
      const mockResult = {
        activities: [
          {
            id: "1",
            user_id: userId,
            activity_type: ActivityType.LOGIN,
            title: "Logged in",
            description: null,
            metadata: null,
            ip_address: null,
            user_agent: null,
            device_info: null,
            created_at: new Date(),
          },
        ],
        total: 1,
        pages: 1,
      };

      (activityRepository.findActivities as jest.Mock).mockResolvedValue(mockResult);

      const query = { page: 1, limit: 10 };
      const result = await activityService.getActivities(userId, query);

      expect(activityRepository.findActivities).toHaveBeenCalledWith(userId, query);
      expect(result.activities).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe("logActivity", () => {
    it("should create a new activity", async () => {
      const input = {
        user_id: userId,
        activity_type: ActivityType.LOGIN,
        title: "Logged in",
      };

      (activityRepository.createActivity as jest.Mock).mockResolvedValue({
        id: "1",
        ...input,
        created_at: new Date(),
      });

      const result = await activityService.logActivity(input as CreateActivityInput);

      expect(activityRepository.createActivity).toHaveBeenCalledWith(input);
      expect(result?.title).toBe("Logged in");
    });

    it("should return null and not throw if repository fails", async () => {
      (activityRepository.createActivity as jest.Mock).mockRejectedValue(new Error("DB error"));

      const input = {
        user_id: userId,
        activity_type: ActivityType.LOGIN,
        title: "Logged in",
      };

      const result = await activityService.logActivity(input as CreateActivityInput);

      expect(result).toBeNull();
    });
  });

  describe("buildActivityTitle", () => {
    it("should return correct title for LOGIN", () => {
      expect(activityService.buildActivityTitle(ActivityType.LOGIN)).toBe("Logged in");
    });

    it("should return correct title for DEPOSIT with amount", () => {
      expect(
        activityService.buildActivityTitle(ActivityType.DEPOSIT, { amount: "500" } as Record<string, unknown>)
      ).toBe("RM500 Deposit");
    });

    it("should return fallback for unknown type", () => {
      expect(activityService.buildActivityTitle("UNKNOWN" as unknown as ActivityType)).toBe("Activity recorded");
    });
  });
});
