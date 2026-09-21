import { isAccessTokenIssuedBeforePasswordChange } from "./access-token-password-change";

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

  it("does not reject when token iat is absent", () => {
    expect(isAccessTokenIssuedBeforePasswordChange(undefined, passwordChangedAt)).toBe(false);
  });

  it("does not reject when password_changed_at is an invalid Date", () => {
    expect(isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds, new Date(NaN))).toBe(
      false
    );
  });

  it("does not reject when token iat is not a finite number", () => {
    expect(isAccessTokenIssuedBeforePasswordChange(Number.NaN, passwordChangedAt)).toBe(false);
    expect(isAccessTokenIssuedBeforePasswordChange(Number.POSITIVE_INFINITY, passwordChangedAt)).toBe(
      false
    );
  });

  it("rejects a token issued before the password change", () => {
    expect(
      isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds - 1, passwordChangedAt)
    ).toBe(true);
  });

  it("rejects a token issued in the same Unix second as the password change", () => {
    expect(
      isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds, passwordChangedAt)
    ).toBe(true);
  });

  it("accepts a token issued after the password change second", () => {
    expect(
      isAccessTokenIssuedBeforePasswordChange(passwordChangedAtSeconds + 1, passwordChangedAt)
    ).toBe(false);
  });
});
