import { OrganizationLogAdapter } from "./adapters/organization-log";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    onboardingLog: { findMany: jest.fn(), count: jest.fn() },
  },
}));

describe("Activity Adapters", () => {
  const userId = "user123";

  describe("OrganizationLogAdapter", () => {
    const adapter = new OrganizationLogAdapter();

    it("should build curated onboarding presentation copy", () => {
      expect(adapter.buildPresentation("ONBOARDING_STARTED")).toEqual({
        title: "Onboarding Started",
        description: "Your organization onboarding has started and you can continue it at any time.",
      });
      expect(adapter.buildPresentation("ONBOARDING_REJECTED", { reason: "Missing documents" })).toEqual({
        title: "Onboarding Rejected",
        description: "Your organization onboarding was rejected: Missing documents",
      });
    });

    it("should transform record correctly", () => {
      const now = new Date();
      const record = {
        id: "log2",
        user_id: userId,
        event_type: "ONBOARDING_COMPLETED",
        metadata: {},
        ip_address: "127.0.0.1",
        user_agent: "Mozilla",
        device_info: "Desktop",
        created_at: now,
      };

      const unified = adapter.transform(record as any);
      expect(unified.category).toBe("organization");
      expect(unified.domain).toBe("onboarding");
      expect(unified.title).toBe("Onboarding Completed");
      expect(unified.description).toBe("This onboarding update was recorded for your organization.");
    });

    it("should only expose major onboarding milestones", () => {
      expect(adapter.getEventTypes()).toEqual([
        "ONBOARDING_STARTED",
        "ONBOARDING_CANCELLED",
        "ONBOARDING_REJECTED",
        "FINAL_APPROVAL_COMPLETED",
        "ONBOARDING_APPROVED",
      ]);
    });
  });
});
