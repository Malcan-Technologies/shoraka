import {
  hrefWithoutDepositReturn,
  isDepositReturnDismissed,
  markDepositReturnDismissed,
} from "./deposit-return-params";

describe("hrefWithoutDepositReturn", () => {
  it("strips deposit return params and keeps the rest of the query", () => {
    expect(
      hrefWithoutDepositReturn(
        "/investments",
        "?tab=transactions&depositReturn=dep_1&returnTo=%2Finvestments"
      )
    ).toBe("/investments?tab=transactions");
  });

  it("returns the pathname when nothing else remains", () => {
    expect(hrefWithoutDepositReturn("/marketplace", "depositReturn=dep_1")).toBe("/marketplace");
  });
});

describe("deposit return dismissals", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
        },
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("remembers a dismissed deposit for this tab session", () => {
    expect(isDepositReturnDismissed("dep_1")).toBe(false);
    markDepositReturnDismissed("dep_1");
    expect(isDepositReturnDismissed("dep_1")).toBe(true);
    expect(isDepositReturnDismissed("dep_2")).toBe(false);
  });
});
