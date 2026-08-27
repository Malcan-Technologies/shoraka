import { NextFunction, Request, Response } from "express";
import { PortalContext } from "../../lib/http/portal-context";
import { portalContextMiddleware } from "./portal-context";

function fakeReq(init: { origin?: string; referer?: string; xPortal?: string }): Request {
  return {
    headers: {
      ...(init.origin ? { origin: init.origin } : {}),
      ...(init.referer ? { referer: init.referer } : {}),
      ...(init.xPortal ? { "x-portal": init.xPortal } : {}),
    },
  } as Request;
}

function detectedPortal(req: Request): string | undefined {
  let portal: string | undefined;
  const next: NextFunction = () => {
    portal = PortalContext.get();
  };
  portalContextMiddleware(req, {} as Response, next);
  return portal;
}

describe("portalContextMiddleware", () => {
  it("leaves localhost:3000 landing unset", () => {
    expect(detectedPortal(fakeReq({ origin: "http://localhost:3000/" }))).toBeUndefined();
    expect(detectedPortal(fakeReq({ referer: "http://localhost:3000/marketplace" }))).toBeUndefined();
  });

  it("leaves production www and apex landing unset", () => {
    expect(detectedPortal(fakeReq({ origin: "https://www.cashsouk.com/" }))).toBeUndefined();
    expect(detectedPortal(fakeReq({ origin: "https://cashsouk.com/" }))).toBeUndefined();
  });

  it("maps localhost:3002 to investor", () => {
    expect(detectedPortal(fakeReq({ origin: "http://localhost:3002/" }))).toBe("investor");
  });

  it("maps localhost:3001 to issuer", () => {
    expect(detectedPortal(fakeReq({ origin: "http://localhost:3001/" }))).toBe("issuer");
  });

  it("maps localhost:3003 to admin", () => {
    expect(detectedPortal(fakeReq({ origin: "http://localhost:3003/" }))).toBe("admin");
  });

  it("maps investor hostname to investor", () => {
    expect(detectedPortal(fakeReq({ origin: "https://investor.cashsouk.com/" }))).toBe("investor");
  });

  it("maps issuer hostname to issuer", () => {
    expect(detectedPortal(fakeReq({ origin: "https://issuer.cashsouk.com/" }))).toBe("issuer");
  });

  it("maps admin hostname to admin", () => {
    expect(detectedPortal(fakeReq({ origin: "https://admin.cashsouk.com/" }))).toBe("admin");
  });

  it("prefers valid x-portal over Origin", () => {
    expect(
      detectedPortal(
        fakeReq({
          origin: "https://investor.cashsouk.com/",
          xPortal: "issuer",
        })
      )
    ).toBe("issuer");
    expect(
      detectedPortal(
        fakeReq({
          origin: "http://localhost:3000/",
          xPortal: "investor",
        })
      )
    ).toBe("investor");
  });

  it("leaves unknown hosts unset", () => {
    expect(detectedPortal(fakeReq({ origin: "https://example.com/" }))).toBeUndefined();
    expect(detectedPortal(fakeReq({}))).toBeUndefined();
  });
});
