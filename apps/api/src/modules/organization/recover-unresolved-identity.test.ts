import * as fs from "fs";
import * as path from "path";

describe("unresolved identity recovery route", () => {
  it("exposes issuer and investor recover endpoints", () => {
    const controller = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");
    const service = fs.readFileSync(path.join(__dirname, "service.ts"), "utf8");
    expect(controller).toContain('router.patch("/issuer/:id/unresolved-identity"');
    expect(controller).toContain('router.patch("/investor/:id/unresolved-identity"');
    expect(service).toContain("attachGovernmentIdToUnresolvedCorporateEntities");
    expect(service).toContain("async recoverUnresolvedIdentity");
  });
});
