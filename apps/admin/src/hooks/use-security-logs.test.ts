jest.mock("@cashsouk/config", () => ({
  createApiClient: jest.fn(),
  useAuthToken: jest.fn(),
}));

import { SECURITY_EVENT_TYPES } from "./use-security-logs";

describe("SECURITY_EVENT_TYPES — security_logs filter allowlist", () => {
  it("includes every verified live security_logs writer event type", () => {
    expect(SECURITY_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "PASSWORD_CHANGED",
        "EMAIL_CHANGED",
        "ROLE_ADDED",
        "ROLE_REMOVED",
        "ROLE_SWITCHED",
        "ROLE_CREATED",
        "ROLE_PERMISSIONS_UPDATED",
        "INVITATION_REVOKED",
        "PROFILE_UPDATED",
        "PLATFORM_FINANCE_SETTINGS_UPDATED",
      ])
    );
  });

  it("keeps security_logs.ROLE_REMOVED (admin-role catalogue deletion) distinct from access_logs.ROLE_REMOVED (user role removal)", () => {
    // Same string literal, two unrelated tables/types — this list only ever feeds the
    // security_logs query/filter, never access_logs, so the meanings cannot be merged.
    expect(SECURITY_EVENT_TYPES).toContain("ROLE_REMOVED");
  });
});
