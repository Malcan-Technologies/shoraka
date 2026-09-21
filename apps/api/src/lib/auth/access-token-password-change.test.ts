import {
  isAccessTokenIssuedBeforePasswordChange,
  resolveAccessTokenAuthTimeSeconds,
} from "./access-token-password-change";

describe("resolveAccessTokenAuthTimeSeconds", () => {
  it("prefers numeric auth_time over iat", () => {
    expect(resolveAccessTokenAuthTimeSeconds(1_700_000_000, 1_700_000_500)).toBe(1_700_000_000);
  });

  it("falls back to iat when auth_time is absent", () => {
    expect(resolveAccessTokenAuthTimeSeconds(undefined, 1_700_000_500)).toBe(1_700_000_500);
  });

  it("does not treat non-numeric auth_time as authoritative", () => {
    expect(resolveAccessTokenAuthTimeSeconds("1700000000", 1_700_000_500)).toBe(1_700_000_500);
    expect(resolveAccessTokenAuthTimeSeconds(Number.NaN, 1_700_000_500)).toBe(1_700_000_500);
  });

  it("returns undefined when both claims are absent or non-finite", () => {
    expect(resolveAccessTokenAuthTimeSeconds(undefined, undefined)).toBeUndefined();
    expect(resolveAccessTokenAuthTimeSeconds(Number.POSITIVE_INFINITY, Number.NaN)).toBeUndefined();
  });
});

describe("isAccessTokenIssuedBeforePasswordChange", () => {
  const passwordChangedAt = new Date("2024-01-15T12:00:00.400Z");
  const passwordChangedAtSeconds = Math.floor(passwordChangedAt.getTime() / 1000);

  it("does not reject when password_changed_at is absent", () => {
    expect(isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds - 60, null)).toBe(
      false
    );
    expect(isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds - 60, undefined)).toBe(
      false
    );
  });

  it("does not reject when token authentication time is absent", () => {
    expect(isAccessTokenIssuedBeforePasswordChange(undefined, passwordChangedAt)).toBe(false);
  });

  it("does not reject when password_changed_at is an invalid Date", () => {
    expect(isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds, new Date(NaN))).toBe(
      false
    );
  });

  it("does not reject when token authentication time is not a finite number", () => {
    expect(isAccessTokenIssuedBeforePasswordChange(Number.NaN, passwordChangedAt)).toBe(false);
    expect(
      isAccessTokenIssuedBeforePasswordChange(Number.POSITIVE_INFINITY, passwordChangedAt)
    ).toBe(false);
  });

  it("rejects a token authenticated before the password change", () => {
    expect(
      isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds - 1, passwordChangedAt)
    ).toBe(true);
  });

  it("rejects a token authenticated in the same Unix second as the password change", () => {
    expect(
      isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds, passwordChangedAt)
    ).toBe(true);
  });

  it("accepts a token authenticated after the password change second", () => {
    expect(
      isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds + 1, passwordChangedAt)
    ).toBe(false);
  });

  it("rejects a refreshed JWT whose auth_time predates the change even when iat is new", () => {
    const authTime = resolveAccessTokenAuthTimeSeconds(
      passwordChangedAtSeconds - 30,
      passwordChangedAtSeconds + 60
    );
    expect(isAccessTokenIssuedBeforePasswordChange(authTime, passwordChangedAt)).toBe(true);
  });

  it("accepts a fresh login whose auth_time is after the password change", () => {
    const authTime = resolveAccessTokenAuthTimeSeconds(
      passwordChangedAtSeconds + 1,
      passwordChangedAtSeconds + 1
    );
    expect(isAccessTokenIssuedBeforePasswordChange(authTime, passwordChangedAt)).toBe(false);
  });

  it("falls back to iat when auth_time is absent", () => {
    const staleIat = resolveAccessTokenAuthTimeSeconds(undefined, passwordChangedAtSeconds - 1);
    const freshIat = resolveAccessTokenAuthTimeSeconds(undefined, passwordChangedAtSeconds + 1);
    expect(isAccessTokenIssuedBeforePasswordChange(staleIat, passwordChangedAt)).toBe(true);
    expect(isAccessTokenIssuedBeforePasswordChange(freshIat, passwordChangedAt)).toBe(false);
  });
});
