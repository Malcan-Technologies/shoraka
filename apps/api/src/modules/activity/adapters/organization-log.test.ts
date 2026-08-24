import { OrganizationLogAdapter } from "./organization-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    onboardingLog: { findMany: jest.fn(), count: jest.fn() },
  },
}));

describe("OrganizationLogAdapter", () => {
  const adapter = new OrganizationLogAdapter();

  it("makes COD_REJECTED visible in the issuer/investor onboarding Activity allowlist", () => {
    // COD_REJECTED is the corporate (COD) onboarding rejection path — the user already receives
    // an ONBOARDING_REJECTED notification for this outcome, so their own Activity history must
    // retain the milestone too.
    expect(adapter.getEventTypes()).toContain("COD_REJECTED");
  });

  it("uses the canonical onboarding-rejection copy for COD_REJECTED, without raw webhook/provider details", () => {
    const presentation = adapter.buildPresentation("COD_REJECTED", {
      organizationId: "org-1",
      requestId: "req-123",
      previousStatus: "PENDING",
      newStatus: "REJECTED",
    });
    expect(presentation).toEqual({
      title: "Onboarding Rejected",
      description: "Your organization onboarding was rejected.",
    });
    expect(presentation.description).not.toMatch(/req-123|requestId|webhook/i);
  });

  it("keeps COD_REJECTED copy consistent with the individual-onboarding ONBOARDING_REJECTED title", () => {
    const cod = adapter.buildPresentation("COD_REJECTED", {});
    const individual = adapter.buildPresentation("ONBOARDING_REJECTED", {});
    expect(cod.title).toBe(individual.title);
  });

  it("does not expose unrelated admin/internal onboarding event types", () => {
    const eventTypes = adapter.getEventTypes();
    expect(eventTypes).not.toContain("TNC_ACCEPTED");
    expect(eventTypes).not.toContain("KYC_APPROVED");
    expect(eventTypes).not.toContain("KYB_APPROVED");
  });
});
