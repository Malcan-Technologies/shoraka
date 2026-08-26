import { legalDocumentAcceptanceService } from "./acceptance-service";

describe("resolveAuthorizedAccountAudience", () => {
  const resolve = legalDocumentAcceptanceService.resolveAuthorizedAccountAudience.bind(
    legalDocumentAcceptanceService
  );

  it("uses activeRole for a dual-role user", () => {
    expect(resolve(["INVESTOR", "ISSUER"], undefined, "INVESTOR")).toBe("INVESTOR");
    expect(resolve(["ISSUER", "INVESTOR"], undefined, "ISSUER")).toBe("ISSUER");
  });

  it("rejects empty roles instead of inventing Investor", () => {
    expect(() => resolve([], undefined, "INVESTOR")).toThrow(/issuer or investor/i);
    expect(() => resolve([], undefined, undefined)).toThrow(/issuer or investor/i);
  });
});
