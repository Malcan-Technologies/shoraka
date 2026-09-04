import {
  getPlainConfig,
  isPlainChatConfigured,
  resetPlainConfigCache,
} from "./plain";

describe("Plain config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PLAIN_API_KEY;
    delete process.env.PLAIN_CHAT_APP_ID;
    delete process.env.PLAIN_CHAT_SECRET;
    resetPlainConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetPlainConfigCache();
  });

  it("returns trimmed values and reports chat as configured", () => {
    process.env.PLAIN_API_KEY = " api-key ";
    process.env.PLAIN_CHAT_APP_ID = " app-id ";
    process.env.PLAIN_CHAT_SECRET = " chat-secret ";

    expect(getPlainConfig()).toEqual({
      apiKey: "api-key",
      chatAppId: "app-id",
      chatSecret: "chat-secret",
    });
    expect(isPlainChatConfigured()).toBe(true);
  });

  it("returns null values and reports chat as unconfigured", () => {
    process.env.PLAIN_CHAT_SECRET = "   ";

    expect(getPlainConfig()).toEqual({
      apiKey: null,
      chatAppId: null,
      chatSecret: null,
    });
    expect(isPlainChatConfigured()).toBe(false);
  });

  it("reloads environment values after the cache is reset", () => {
    expect(isPlainChatConfigured()).toBe(false);

    process.env.PLAIN_CHAT_SECRET = "new-secret";
    expect(isPlainChatConfigured()).toBe(false);

    resetPlainConfigCache();
    expect(isPlainChatConfigured()).toBe(true);
  });
});
