import { SC_PAR90_LIMIT_PERCENT } from "@cashsouk/types";
import { ladderBarWidth, par90LimitBarWidth } from "./dashboard-credit-quality-bars";

describe("credit quality bar widths", () => {
  it("maps ladder rows to percent of book on a 0–100 scale", () => {
    expect(ladderBarWidth(0)).toBe(0);
    expect(ladderBarWidth(17.4)).toBe(17.4);
    expect(ladderBarWidth(41)).toBe(41);
    expect(ladderBarWidth(88.2)).toBe(88.2);
    expect(ladderBarWidth(110)).toBe(100);
  });

  it("maps the PAR90 hero bar to the SC 5% limit, not 100% of book", () => {
    expect(par90LimitBarWidth(0)).toBe(0);
    expect(par90LimitBarWidth(SC_PAR90_LIMIT_PERCENT / 2)).toBe(50);
    expect(par90LimitBarWidth(SC_PAR90_LIMIT_PERCENT)).toBe(100);
    expect(par90LimitBarWidth(SC_PAR90_LIMIT_PERCENT * 2)).toBe(100);
  });
});
