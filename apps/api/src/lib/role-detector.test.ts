import { Request } from "express";
import { detectInitiatingPortal, parseKnownPortal } from "./role-detector";

function fakeReq(init: {
  query?: Record<string, unknown>;
  origin?: string;
  referer?: string;
}): Request {
  return {
    query: init.query ?? {},
    get: (name: string) => {
      if (name === "origin") return init.origin;
      if (name === "referer") return init.referer;
      return undefined;
    },
  } as Request;
}

describe("parseKnownPortal", () => {
  it("accepts role-shaped and portal-shaped values", () => {
    expect(parseKnownPortal("INVESTOR")).toBe("investor");
    expect(parseKnownPortal("issuer")).toBe("issuer");
    expect(parseKnownPortal("ADMIN")).toBe("admin");
  });

  it("does not default unknown values to investor", () => {
    expect(parseKnownPortal(undefined)).toBeNull();
    expect(parseKnownPortal("")).toBeNull();
    expect(parseKnownPortal("unknown")).toBeNull();
    expect(parseKnownPortal("landing")).toBeNull();
  });
});

describe("detectInitiatingPortal", () => {
  it("prefers explicit ?portal= over role and hostname", () => {
    expect(
      detectInitiatingPortal(
        fakeReq({
          query: { portal: "issuer", role: "INVESTOR" },
          origin: "https://investor.cashsouk.com/",
        })
      )
    ).toBe("issuer");
  });

  it("uses ?role= when portal is absent", () => {
    expect(detectInitiatingPortal(fakeReq({ query: { role: "ISSUER" } }))).toBe("issuer");
    expect(detectInitiatingPortal(fakeReq({ query: { role: "INVESTOR" } }))).toBe("investor");
    expect(detectInitiatingPortal(fakeReq({ query: { role: "ADMIN" } }))).toBe("admin");
  });

  it("uses Origin/Referer hostname when query is absent", () => {
    expect(
      detectInitiatingPortal(fakeReq({ origin: "https://issuer.cashsouk.com/account" }))
    ).toBe("issuer");
    expect(
      detectInitiatingPortal(fakeReq({ referer: "https://admin.cashsouk.com/" }))
    ).toBe("admin");
  });

  it("returns null for landing/localhost instead of claiming investor", () => {
    expect(detectInitiatingPortal(fakeReq({ origin: "https://www.cashsouk.com/" }))).toBeNull();
    expect(detectInitiatingPortal(fakeReq({ origin: "http://localhost:3002/" }))).toBeNull();
    expect(detectInitiatingPortal(fakeReq({}))).toBeNull();
  });
});
