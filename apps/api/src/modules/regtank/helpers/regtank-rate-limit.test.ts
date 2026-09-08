import { AppError } from "../../../lib/http/error-handler";
import { parseRetryAfterHeader, isRegTankRateLimited } from "./regtank-rate-limit";
import { REGTANK_RATE_LIMITED_CODE } from "./regtank-rate-limit";

describe("parseRetryAfterHeader", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfterHeader("12")).toBe(12);
    expect(parseRetryAfterHeader("0")).toBe(0);
  });

  it("returns null for empty or invalid values", () => {
    expect(parseRetryAfterHeader(null)).toBeNull();
    expect(parseRetryAfterHeader("")).toBeNull();
    expect(parseRetryAfterHeader("not-a-date")).toBeNull();
  });

  it("parses HTTP-date Retry-After as remaining seconds", () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const parsed = parseRetryAfterHeader(future);
    expect(parsed).toBeGreaterThanOrEqual(4);
    expect(parsed).toBeLessThanOrEqual(6);
  });
});

describe("isRegTankRateLimited", () => {
  it("detects AppError 429 / REGTANK_RATE_LIMITED", () => {
    expect(
      isRegTankRateLimited(new AppError(429, REGTANK_RATE_LIMITED_CODE, "limited"))
    ).toBe(true);
    expect(isRegTankRateLimited(new Error("429"))).toBe(false);
  });
});
