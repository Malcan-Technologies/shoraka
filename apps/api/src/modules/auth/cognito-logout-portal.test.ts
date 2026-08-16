import { AUDIT_PORTAL } from "../../lib/audit/context";
import { resolveCognitoLogoutAuditPortal } from "./cognito-logout-portal";

describe("resolveCognitoLogoutAuditPortal", () => {
  it("maps ?portal=issuer to ISSUER", () => {
    expect(resolveCognitoLogoutAuditPortal({ queryPortal: "issuer" })).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("maps ?portal=investor to INVESTOR", () => {
    expect(resolveCognitoLogoutAuditPortal({ queryPortal: "investor" })).toBe(AUDIT_PORTAL.INVESTOR);
  });

  it("maps ?portal=admin to ADMIN", () => {
    expect(resolveCognitoLogoutAuditPortal({ queryPortal: "admin" })).toBe(AUDIT_PORTAL.ADMIN);
  });

  it("uses issuer hostname when portal query is missing", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        referer: "https://issuer.cashsouk.com/account",
      })
    ).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("uses investor hostname when portal query is invalid", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "marketplace",
        referer: "https://investor.cashsouk.com/portfolio",
      })
    ).toBe(AUDIT_PORTAL.INVESTOR);
  });

  it("does not infer portal from roles on localhost when query is missing", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        referer: "http://localhost:3001/account",
      })
    ).toBeNull();
  });

  it("does not infer portal from a single ISSUER role on localhost", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: undefined,
        referer: "http://localhost:3001/account",
      })
    ).toBeNull();
  });

  it("does not infer portal from multi-role users on localhost", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        referer: "http://localhost:3001/account",
        origin: "http://localhost:3001",
      })
    ).toBeNull();
  });

  it("does not infer portal from ADMIN role when query is invalid and host is localhost", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "marketplace",
        referer: "http://localhost:3003/users",
      })
    ).toBeNull();
  });

  it("prefers ?portal=issuer over investor hostname", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "issuer",
        referer: "https://investor.cashsouk.com/",
      })
    ).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("prefers ?portal=investor over issuer hostname", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "investor",
        referer: "https://issuer.cashsouk.com/",
      })
    ).toBe(AUDIT_PORTAL.INVESTOR);
  });
});
