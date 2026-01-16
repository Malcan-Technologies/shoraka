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

    it("should build correct descriptions", () => {
      expect(adapter.buildDescription("ONBOARDING_STARTED")).toBe("Started the onboarding process");
      expect(adapter.buildDescription("FORM_FILLED", { section: "Business Info" })).toBe(
        "Completed onboarding section: Business Info"
      );
      expect(adapter.buildDescription("ONBOARDING_STATUS_UPDATED", { status: "APPROVED" })).toBe(
        "Onboarding status updated to: APPROVED"
      );
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
    });
  });
});
