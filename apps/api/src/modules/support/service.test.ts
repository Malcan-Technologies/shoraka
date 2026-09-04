import crypto from "crypto";
import { buildSupportChatIdentity, computePlainEmailHash } from "./service";

describe("support chat identity", () => {
  it("computes the expected HMAC-SHA256 hex digest", () => {
    const email = "person@example.com";
    const secret = "plain-chat-secret";
    const expected = crypto.createHmac("sha256", secret).update(email).digest("hex");

    expect(computePlainEmailHash(email, secret)).toBe(expected);
  });

  it("normalises email before returning and hashing it", () => {
    const secret = "plain-chat-secret";
    const identity = buildSupportChatIdentity(
      {
        email: "  Person@Example.COM ",
        first_name: "  Aisha ",
        last_name: " Rahman  ",
      },
      secret
    );

    expect(identity).toEqual({
      email: "person@example.com",
      emailHash: crypto
        .createHmac("sha256", secret)
        .update("person@example.com")
        .digest("hex"),
      fullName: "Aisha Rahman",
      shortName: "Aisha",
    });
  });

  it.each([
    {
      first_name: "  ",
      last_name: " Rahman ",
      fullName: "Rahman",
      shortName: null,
    },
    {
      first_name: null,
      last_name: null,
      fullName: null,
      shortName: null,
    },
  ])("uses null name fallbacks", ({ first_name, last_name, fullName, shortName }) => {
    const identity = buildSupportChatIdentity(
      { email: "person@example.com", first_name, last_name },
      "secret"
    );

    expect(identity.fullName).toBe(fullName);
    expect(identity.shortName).toBe(shortName);
  });
});
