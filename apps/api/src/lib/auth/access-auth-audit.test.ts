import { classifyAccessAuthEvent } from "./access-auth-audit";

describe("classifyAccessAuthEvent", () => {
  it("writes SIGNUP only for the first CashSouk user row with no prior SIGNUP", () => {
    expect(
      classifyAccessAuthEvent({ isNewCashSoukUser: true, hasSuccessfulSignup: false })
    ).toBe("SIGNUP");
  });

  it("writes LOGIN when the user already exists", () => {
    expect(
      classifyAccessAuthEvent({ isNewCashSoukUser: false, hasSuccessfulSignup: false })
    ).toBe("LOGIN");
  });

  it("writes LOGIN instead of a second SIGNUP", () => {
    expect(
      classifyAccessAuthEvent({ isNewCashSoukUser: true, hasSuccessfulSignup: true })
    ).toBe("LOGIN");
  });
});
