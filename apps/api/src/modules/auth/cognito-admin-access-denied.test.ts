import { UserRole } from "@prisma/client";
import { AUDIT_ACTOR_TYPE, AUDIT_PORTAL } from "../../lib/audit/context";
import { resolveCognitoAdminAccessDeniedClassification } from "./cognito-admin-access-denied";

function classifyRoles(roles: UserRole[]) {
  return resolveCognitoAdminAccessDeniedClassification(roles.includes(UserRole.ADMIN));
}

describe("resolveCognitoAdminAccessDeniedClassification", () => {
  it("roles=[] + requestedRole ADMIN: USER actor, MISSING_ADMIN_ROLE, portal stays ADMIN at writer", () => {
    const classified = classifyRoles([]);
    expect(classified).toEqual({
      actorType: AUDIT_ACTOR_TYPE.USER,
      reasonCode: "MISSING_ADMIN_ROLE",
    });
    expect(AUDIT_PORTAL.ADMIN).toBe("ADMIN");
  });

  it("roles=[ISSUER] + requestedRole ADMIN: USER actor", () => {
    expect(classifyRoles([UserRole.ISSUER]).actorType).toBe(AUDIT_ACTOR_TYPE.USER);
    expect(classifyRoles([UserRole.ISSUER]).reasonCode).toBe("MISSING_ADMIN_ROLE");
  });

  it("roles=[INVESTOR] + requestedRole ADMIN: USER actor", () => {
    expect(classifyRoles([UserRole.INVESTOR]).actorType).toBe(AUDIT_ACTOR_TYPE.USER);
    expect(classifyRoles([UserRole.INVESTOR]).reasonCode).toBe("MISSING_ADMIN_ROLE");
  });

  it("roles includes ADMIN but inactive: ADMIN actor, ADMIN_INACTIVE", () => {
    expect(classifyRoles([UserRole.ADMIN])).toEqual({
      actorType: AUDIT_ACTOR_TYPE.ADMIN,
      reasonCode: "ADMIN_INACTIVE",
    });
    expect(classifyRoles([UserRole.ADMIN, UserRole.ISSUER]).actorType).toBe(AUDIT_ACTOR_TYPE.ADMIN);
  });

  it("does not derive actorType from requestedRole or portal", () => {
    const issuer = resolveCognitoAdminAccessDeniedClassification(false);
    expect(issuer.actorType).not.toBe(AUDIT_ACTOR_TYPE.ADMIN);
    expect(issuer.actorType).toBe(AUDIT_ACTOR_TYPE.USER);
  });
});
