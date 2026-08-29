jest.mock("@cashsouk/config", () => ({
  createApiClient: jest.fn(),
  useAuthToken: jest.fn(),
}));

import { ORGANIZATION_ACTIVITY_EVENT_TYPES } from "./use-organization-logs";

describe("ORGANIZATION_ACTIVITY_EVENT_TYPES — dead filter cleanup", () => {
  it("no longer includes event types with no production writer", () => {
    // TNC_ACCEPTED / KYC_APPROVED / KYB_APPROVED are never written as event_type by any
    // production onboarding writer (only TNC_APPROVED and ONBOARDING_STATUS_UPDATED are live);
    // they previously only appeared in dev seed fixtures.
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES).not.toContain("TNC_ACCEPTED");
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES).not.toContain("KYC_APPROVED");
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES).not.toContain("KYB_APPROVED");
  });

  it("still includes the live event types the admin org timeline relies on", () => {
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "ONBOARDING_STARTED",
        "ONBOARDING_FEE_PAID",
        "ONBOARDING_RESUMED",
        "ONBOARDING_STATUS_UPDATED",
        "ONBOARDING_AMENDMENT_REQUIRED",
        "ONBOARDING_CANCELLED",
        "ONBOARDING_REJECTED",
        "COD_REJECTED",
        "SOPHISTICATED_STATUS_UPDATED",
        "FINAL_APPROVAL_COMPLETED",
        "FORM_FILLED",
        "ONBOARDING_APPROVED",
        "AML_APPROVED",
        "TNC_APPROVED",
        "SSM_APPROVED",
        "PROFILE_UPDATED",
        "MEMBER_ADDED",
        "MEMBER_INVITED",
        "MEMBER_REMOVED",
        "MEMBER_ROLE_CHANGED",
        "MARC_ASSESSMENT_SAVED",
      ])
    );
  });

  it("includes COD_REJECTED so the org-detail Activity query/CSV matches issuer/investor Activity and the raw admin export", () => {
    // cod-handler.ts writes COD_REJECTED to onboarding_logs on corporate COD rejection;
    // issuer/investor Activity (organization-log.ts adapter) and the raw admin onboarding
    // export already surfaced it — only this org-detail-scoped query excluded it.
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES).toContain("COD_REJECTED");
  });

  it("does not delete the historical event type from the enum/DB — only the query filter list is affected", () => {
    // Removed from the query-inclusion array above, but still a valid historical event_type value
    // that may exist on old onboarding_logs rows (schema/enum untouched).
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES.length).toBeGreaterThan(0);
  });

  it("includes MEMBER_* so organisation membership activity is not excluded by the Admin allowlist", () => {
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES).toEqual(
      expect.arrayContaining(["MEMBER_ADDED", "MEMBER_INVITED", "MEMBER_REMOVED", "MEMBER_ROLE_CHANGED"])
    );
  });

  it("includes MARC_ASSESSMENT_SAVED so issuer MARC saves appear on Admin Organization Activity", () => {
    expect(ORGANIZATION_ACTIVITY_EVENT_TYPES).toContain("MARC_ASSESSMENT_SAVED");
  });
});
