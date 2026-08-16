import { resolveAuthErrorPageAction } from "./auth-error-page";

describe("resolveAuthErrorPageAction", () => {
  it("does not show Authentication Error for admin authorization rejection", () => {
    expect(resolveAuthErrorPageAction("admin_access_denied")).toBe("go-home");
  });

  it("still shows /auth-error for genuine authentication failures", () => {
    expect(resolveAuthErrorPageAction("missing_state")).toBe("show-error");
    expect(resolveAuthErrorPageAction("expired_session")).toBe("show-error");
    expect(resolveAuthErrorPageAction("TOKEN_EXCHANGE_FAILED")).toBe("show-error");
    expect(resolveAuthErrorPageAction("unknown_error")).toBe("show-error");
    expect(resolveAuthErrorPageAction(null)).toBe("show-error");
  });
});
