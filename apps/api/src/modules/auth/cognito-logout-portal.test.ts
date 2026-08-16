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

  it("accepts uppercase explicit portal values", () => {
    expect(resolveCognitoLogoutAuditPortal({ queryPortal: "ISSUER" })).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("uses Origin/Referer hostname when portal query is missing", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        referer: "http://localhost:3001/account",
        origin: "https://issuer.cashsouk.com",
        roles: ["INVESTOR"],
      })
    ).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("uses Origin/Referer hostname when portal query is invalid", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "marketplace",
        referer: "https://admin.cashsouk.com/users",
        roles: ["ISSUER"],
      })
    ).toBe(AUDIT_PORTAL.ADMIN);
  });

  it("falls back to user.roles[0] when query and hostname are absent", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        referer: "http://localhost:3001/account",
        roles: ["INVESTOR", "ISSUER"],
      })
    ).toBe(AUDIT_PORTAL.INVESTOR);
  });

  it("returns null when nothing can be resolved", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        referer: "http://localhost:3001/account",
        roles: [],
      })
    ).toBeNull();
  });

  it("prefers ?portal=issuer when roles are empty", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "issuer",
        referer: "http://localhost:3001/account",
        roles: [],
      })
    ).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("prefers ?portal=issuer over multi-role roles[0] INVESTOR", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "issuer",
        referer: "https://investor.cashsouk.com/",
        roles: ["INVESTOR", "ISSUER"],
      })
    ).toBe(AUDIT_PORTAL.ISSUER);
  });

  it("prefers ?portal=investor over multi-role roles[0] ISSUER", () => {
    expect(
      resolveCognitoLogoutAuditPortal({
        queryPortal: "investor",
        referer: "https://issuer.cashsouk.com/",
        roles: ["ISSUER", "INVESTOR"],
      })
    ).toBe(AUDIT_PORTAL.INVESTOR);
  });
});
