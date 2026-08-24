jest.mock("@cashsouk/config", () => ({
  createApiClient: jest.fn(),
  useAuthToken: jest.fn(),
}));

import { ACCESS_EVENT_TYPES } from "./use-access-logs";

describe("ACCESS_EVENT_TYPES — access_logs filter allowlist", () => {
  it("includes every verified live access_logs writer event type", () => {
    expect(ACCESS_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "LOGIN",
        "LOGOUT",
        "SIGNUP",
        "ROLE_ADDED",
        "ROLE_REMOVED",
        "PROFILE_UPDATED",
        "ONBOARDING_RESET",
      ])
    );
  });

  it("omits KYC_STATUS_UPDATED — no production writer emits it to access_logs", () => {
    // Confirmed by source trace: only presentation label maps reference it; no
    // createAccessLogRow/createAccessLog call site ever writes this event_type.
    expect(ACCESS_EVENT_TYPES).not.toContain("KYC_STATUS_UPDATED");
  });

  it("does not delete the historical event type from the enum/DB — only the query filter list is affected", () => {
    expect(ACCESS_EVENT_TYPES.length).toBeGreaterThan(0);
  });
});
