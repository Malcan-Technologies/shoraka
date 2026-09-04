import {
  buildPlainInitConfig,
  markPlainChatAutoOpened,
  nextPlainSyncAction,
  shouldAutoOpenPlainChat,
  toPlainCustomerDetails,
} from "./plain-chat-config";

const identity = {
  email: "issuer@example.com",
  emailHash: "abc123",
  fullName: "Ada Lovelace",
  shortName: "Ada",
};

describe("toPlainCustomerDetails", () => {
  it("copies email fields and non-null names", () => {
    expect(toPlainCustomerDetails(identity)).toEqual({
      email: "issuer@example.com",
      emailHash: "abc123",
      fullName: "Ada Lovelace",
      shortName: "Ada",
    });
  });

  it("omits null names", () => {
    expect(
      toPlainCustomerDetails({
        email: "anon@example.com",
        emailHash: "hash",
        fullName: null,
        shortName: null,
      })
    ).toEqual({
      email: "anon@example.com",
      emailHash: "hash",
    });
  });
});

describe("buildPlainInitConfig", () => {
  it("builds appId and Help Center link without customer details", () => {
    expect(
      buildPlainInitConfig({
        appId: "app_123",
        helpCenterUrl: "https://help.cashsouk.com",
      })
    ).toEqual({
      appId: "app_123",
      links: [
        { icon: "book", text: "Help Center", url: "https://help.cashsouk.com" },
      ],
      theme: "light",
    });
  });

  it("inits without waiting for identity when customer is still loading", () => {
    const config = buildPlainInitConfig({
      appId: "app_123",
      helpCenterUrl: "https://help.cashsouk.com",
      customer: undefined,
    });
    expect(config.customerDetails).toBeUndefined();
    expect(config.appId).toBe("app_123");
    expect(config.theme).toBe("light");
  });

  it("omits customerDetails when customer is null", () => {
    const config = buildPlainInitConfig({
      appId: "app_123",
      helpCenterUrl: "https://help.cashsouk.com",
      customer: null,
    });
    expect(config.customerDetails).toBeUndefined();
  });

  it("includes customerDetails when identity is present", () => {
    expect(
      buildPlainInitConfig({
        appId: "app_123",
        helpCenterUrl: "https://help.cashsouk.com",
        customer: identity,
      })
    ).toEqual({
      appId: "app_123",
      links: [
        { icon: "book", text: "Help Center", url: "https://help.cashsouk.com" },
      ],
      theme: "light",
      customerDetails: {
        email: "issuer@example.com",
        emailHash: "abc123",
        fullName: "Ada Lovelace",
        shortName: "Ada",
      },
    });
  });
});

describe("nextPlainSyncAction", () => {
  it("skips when the script API is not ready", () => {
    expect(
      nextPlainSyncAction({
        appId: "app_123",
        helpCenterUrl: "https://help.cashsouk.com",
        hasApi: false,
        alreadyInitialized: false,
      })
    ).toEqual({ type: "skip" });
  });

  it("inits once, then only identifies later customers", () => {
    expect(
      nextPlainSyncAction({
        appId: "app_123",
        helpCenterUrl: "https://help.cashsouk.com",
        hasApi: true,
        alreadyInitialized: false,
      }).type
    ).toBe("init");

    expect(
      nextPlainSyncAction({
        appId: "app_123",
        helpCenterUrl: "https://help.cashsouk.com",
        customer: identity,
        hasApi: true,
        alreadyInitialized: true,
      })
    ).toEqual({
      type: "identify",
      details: {
        email: "issuer@example.com",
        emailHash: "abc123",
        fullName: "Ada Lovelace",
        shortName: "Ada",
      },
    });
  });
});

describe("plain chat first-load auto-open", () => {
  it("opens once per session, then stays collapsed", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    expect(shouldAutoOpenPlainChat(storage)).toBe(true);
    markPlainChatAutoOpened(storage);
    expect(shouldAutoOpenPlainChat(storage)).toBe(false);
  });
});
