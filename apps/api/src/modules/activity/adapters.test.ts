import { OrganizationLogAdapter } from "./adapters/organization-log";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    onboardingAuditLog: { findMany: jest.fn(), count: jest.fn() },
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
      expect(adapter.buildPresentation("ONBOARDING_REJECTED", { reasonCode: "Missing documents" })).toEqual({
        title: "Onboarding Rejected",
        description: "Your organization onboarding was rejected: Missing documents",
      });
    });

    it("should transform record correctly", () => {
      const now = new Date();
      const record = {
        id: "log2",
        subject_user_id: userId,
        event_type: "ONBOARDING_COMPLETED",
        metadata: { completionMethod: "LEGACY_COMPLETE_ONBOARDING", previousStatus: "PENDING", newStatus: "COMPLETED" },
        ip_address: "127.0.0.1",
        user_agent: "Mozilla",
        occurred_at: now,
      };

      const unified = adapter.transform(record as never);
      expect(unified.category).toBe("organization");
      expect(unified.domain).toBe("onboarding");
      expect(unified.title).toBe("Onboarding Completed");
      expect(unified.user_id).toBe(userId);
      expect(unified.source_table).toBe("onboarding_audit_logs");
      expect(unified.created_at).toBe(now);
    });

    it("should only expose curated onboarding milestones", () => {
      expect(adapter.getEventTypes()).toEqual([
        "ONBOARDING_STARTED",
        "ONBOARDING_RESUMED",
        "ONBOARDING_RESTARTED",
        "ONBOARDING_REJECTED",
        "ONBOARDING_APPROVED",
        "ONBOARDING_FINAL_APPROVAL_COMPLETED",
        "ONBOARDING_COMPLETED",
      ]);
      expect(adapter.getEventTypes()).not.toContain("ONBOARDING_CANCELLED");
      expect(adapter.getEventTypes()).not.toContain("FORM_FILLED");
      expect(adapter.getEventTypes()).not.toContain("WEBHOOK_RECEIVED");
    });
  });
});
