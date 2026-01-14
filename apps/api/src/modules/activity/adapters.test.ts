import { SecurityLogAdapter } from "./adapters/security-log";
import { OnboardingLogAdapter } from "./adapters/onboarding-log";
import { DocumentLogAdapter } from "./adapters/document-log";
import { prisma } from "../../lib/prisma";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    securityLog: { findMany: jest.fn() },
    onboardingLog: { findMany: jest.fn() },
    documentLog: { findMany: jest.fn() },
  },
}));

describe("Activity Adapters", () => {
  const userId = "user123";

  describe("SecurityLogAdapter", () => {
    const adapter = new SecurityLogAdapter();

    it("should build correct descriptions", () => {
      expect(adapter.buildDescription("PASSWORD_CHANGED", { success: true })).toBe(
        "Changed password successfully"
      );
      expect(
        adapter.buildDescription("PASSWORD_CHANGED", { success: false, error: "WEAK_PASSWORD" })
      ).toBe("Failed password change attempt: WEAK_PASSWORD");
      expect(adapter.buildDescription("SECURITY_ALERT", { alert_type: "UNUSUAL_LOGIN" })).toBe(
        "Security alert: UNUSUAL_LOGIN"
      );
      expect(adapter.buildDescription("ROLE_SWITCHED", { newRole: "ADMIN" })).toBe(
        "Switched active role to ADMIN"
      );
    });

    it("should transform record correctly", () => {
      const now = new Date();
      const record = {
        id: "log1",
        user_id: userId,
        event_type: "PASSWORD_CHANGED",
        metadata: { success: true },
        ip_address: "127.0.0.1",
        user_agent: "Mozilla",
        device_info: "Desktop",
        created_at: now,
      };

      const unified = adapter.transform(record as any);

      expect(unified).toEqual({
        id: "log1",
        user_id: userId,
        category: "security",
        event_type: "PASSWORD_CHANGED",
        activity: "Changed password successfully",
        metadata: { success: true },
        ip_address: "127.0.0.1",
        user_agent: "Mozilla",
        device_info: "Desktop",
        created_at: now,
        source_table: "security_logs",
      });
    });

    it("should query with correct filters", async () => {
      const filters = { limit: 10, offset: 0 };
      await adapter.query(userId, filters);
      expect(prisma.securityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: userId }),
          take: 10,
          skip: 0,
        })
      );
    });
  });

  describe("OnboardingLogAdapter", () => {
    const adapter = new OnboardingLogAdapter();

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
        event_type: "KYC_SUBMITTED",
        metadata: {},
        ip_address: "127.0.0.1",
        user_agent: "Mozilla",
        device_info: "Desktop",
        created_at: now,
      };

      const unified = adapter.transform(record as any);
      expect(unified.activity).toBe("Submitted KYC documents for verification");
      expect(unified.category).toBe("onboarding");
    });
  });

  describe("DocumentLogAdapter", () => {
    const adapter = new DocumentLogAdapter();

    it("should build correct descriptions", () => {
      expect(adapter.buildDescription("DOCUMENT_CREATED", { fileName: "test.pdf" })).toBe(
        "Uploaded document: test.pdf"
      );
      expect(adapter.buildDescription("DOCUMENT_DELETED", { title: "Contract" })).toBe(
        "Deleted document: Contract"
      );
    });

    it("should transform record correctly", () => {
      const now = new Date();
      const record = {
        id: "log3",
        user_id: userId,
        event_type: "DOCUMENT_CREATED",
        metadata: { fileName: "passport.jpg" },
        ip_address: "127.0.0.1",
        user_agent: "Mozilla",
        device_info: "Desktop",
        created_at: now,
      };

      const unified = adapter.transform(record as any);
      expect(unified.activity).toBe("Uploaded document: passport.jpg");
      expect(unified.category).toBe("document");
    });
  });
});
