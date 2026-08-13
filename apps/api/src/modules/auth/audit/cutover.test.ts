import fs from "node:fs";
import path from "node:path";
import { ACCESS_AUDIT_EVENTS } from "./events";
import { SECURITY_AUDIT_EVENTS } from "../../security/audit/events";
import {
  ACCESS_AUDIT_EVENTS as TYPES_ACCESS_EVENTS,
  SECURITY_AUDIT_EVENTS as TYPES_SECURITY_EVENTS,
} from "@cashsouk/types";

const srcRoot = path.join(__dirname, "../../..");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(srcRoot, relativePath), "utf8");
}

function collectTsSources(relativeDirs: string[]): string {
  return relativeDirs
    .flatMap((dir) => {
      const abs = path.join(srcRoot, dir);
      if (!fs.existsSync(abs)) return [];
      return (fs.readdirSync(abs, { recursive: true }) as string[]).map((file) =>
        path.join(abs, file)
      );
    })
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".spec.ts"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

function methodChunk(source: string, methodName: string, length = 8000): string {
  const start = source.indexOf(`async ${methodName}(`);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, start + length);
}

describe("Access/Security audit cutover", () => {
  const authService = readSrc("modules/auth/service.ts");
  const cognitoRoutes = readSrc("modules/auth/cognito.routes.ts");
  const adminService = readSrc("modules/admin/service.ts");
  const organizationService = readSrc("modules/organization/service.ts");
  const notificationService = readSrc("modules/notification/service.ts");
  const middleware = readSrc("lib/auth/middleware.ts");
  const schema = readSrc("../prisma/schema.prisma");
  const userIdGenerator = readSrc("lib/user-id-generator.ts");
  const liveSources = collectTsSources([
    "modules/auth",
    "modules/admin",
    "modules/organization",
    "modules/notification",
    "lib/auth",
  ]);

  it("Access event catalogue is signup/login/logout only", () => {
    expect([...ACCESS_AUDIT_EVENTS]).toEqual(["USER_SIGNED_UP", "USER_LOGGED_IN", "USER_LOGGED_OUT"]);
    expect([...TYPES_ACCESS_EVENTS]).toEqual([...ACCESS_AUDIT_EVENTS]);
  });

  it("Security event catalogues match between API and types", () => {
    expect([...TYPES_SECURITY_EVENTS]).toEqual([...SECURITY_AUDIT_EVENTS]);
    expect(SECURITY_AUDIT_EVENTS).not.toContain("USER_EMAIL_CHANGED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("EMAIL_CHANGE_FAILED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("USER_PUBLIC_ID_ASSIGNED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("USER_ONBOARDING_STATUS_UPDATED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("ONBOARDING_RESET");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("INVESTOR_SOPHISTICATED_STATUS_UPDATED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("ROLE_SWITCHED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("ROLE_REMOVED");
  });

  it("syncUser does not write AccessAuditLog login", () => {
    const chunk = methodChunk(authService, "syncUser", 1800);
    expect(chunk).not.toMatch(/writeAccessAuditLog/);
    expect(chunk).not.toMatch(/createAccessLog/);
    expect(chunk).not.toMatch(/USER_LOGGED_IN/);
  });

  it("OAuth callback is the login/signup writer with API source + COGNITO_OAUTH", () => {
    expect(cognitoRoutes).toMatch(/USER_LOGGED_IN/);
    expect(cognitoRoutes).toMatch(/USER_SIGNED_UP/);
    expect(cognitoRoutes).toMatch(/loginMethod: "COGNITO_OAUTH"/);
    expect(cognitoRoutes).not.toMatch(/accessLog\.create/);
    expect(cognitoRoutes).not.toMatch(/COGNITO_CALLBACK/);
  });

  it("admin Cognito gate denial writes Security ADMIN_ACCESS_DENIED, not Access", () => {
    expect(cognitoRoutes).toMatch(/ADMIN_ACCESS_DENIED/);
    expect(cognitoRoutes).toMatch(/MISSING_ADMIN_ROLE/);
    expect(cognitoRoutes).toMatch(/ADMIN_INACTIVE/);
    const deniedChunk = cognitoRoutes.slice(
      cognitoRoutes.indexOf("ADMIN_ACCESS_DENIED") - 200,
      cognitoRoutes.indexOf("ADMIN_ACCESS_DENIED") + 800
    );
    expect(deniedChunk).not.toMatch(/writeAccessAuditLog/);
    expect(deniedChunk).toMatch(/writeSecurityAuditLogBestEffort/);
  });

  it("logout writes USER_LOGGED_OUT from AuthService and Cognito GET /logout", () => {
    expect(methodChunk(authService, "logout")).toMatch(/USER_LOGGED_OUT/);
    expect(cognitoRoutes).toMatch(/USER_LOGGED_OUT/);
  });

  it("old AccessLog/SecurityLog writers are not called from live services", () => {
    expect(authService).not.toMatch(/createAccessLog\(/);
    expect(authService).not.toMatch(/createSecurityLog\(/);
    expect(adminService).not.toMatch(/createAccessLog\(/);
    expect(adminService).not.toMatch(/createSecurityLog\(/);
    expect(organizationService).not.toMatch(/createAccessLog\(/);
    expect(organizationService).not.toMatch(/createSecurityLog\(/);
    expect(middleware).not.toMatch(/createAccessLog\(/);
    expect(middleware).not.toMatch(/createSecurityLog\(/);
  });

  it("recentLogins uses AccessAuditLog USER_LOGGED_IN", () => {
    expect(methodChunk(authService, "getCurrentUser")).toMatch(
      /accessAuditLogReader\.findRecentLogins/
    );
  });

  it("maps auth/admin/org/notification mutations to the approved Security events", () => {
    expect(methodChunk(authService, "addRole")).toMatch(/USER_ROLE_ADDED/);
    expect(methodChunk(authService, "switchRole")).toMatch(/ACTIVE_ROLE_CHANGED/);
    expect(methodChunk(authService, "updateProfile")).toMatch(/USER_PROFILE_UPDATED/);
    expect(methodChunk(authService, "changePassword", 8000)).toMatch(/PASSWORD_CHANGED/);
    expect(methodChunk(authService, "changePassword", 8000)).toMatch(/PASSWORD_CHANGE_FAILED/);
    expect(methodChunk(authService, "verifyEmail", 8000)).toMatch(/USER_EMAIL_VERIFIED/);
    expect(methodChunk(authService, "verifyEmail", 8000)).toMatch(/EMAIL_VERIFICATION_FAILED/);

    expect(methodChunk(adminService, "updateUserRoles")).toMatch(/USER_ROLES_UPDATED/);
    expect(methodChunk(adminService, "updateUserProfile")).toMatch(/USER_PROFILE_UPDATED_BY_ADMIN/);
    expect(methodChunk(adminService, "updateUserId")).toMatch(/USER_PUBLIC_ID_CHANGED/);
    expect(methodChunk(adminService, "updateAdminRole")).toMatch(/ADMIN_USER_ROLE_CHANGED/);
    expect(methodChunk(adminService, "deactivateAdmin")).toMatch(/ADMIN_USER_DEACTIVATED/);
    expect(methodChunk(adminService, "reactivateAdmin")).toMatch(/ADMIN_USER_REACTIVATED/);
    expect(adminService).toMatch(/ADMIN_ROLE_CREATED/);
    expect(adminService).toMatch(/ADMIN_ROLE_PERMISSIONS_UPDATED/);
    expect(adminService).toMatch(/ADMIN_ROLE_DELETED/);
    expect(methodChunk(adminService, "generateInvitationUrl")).toMatch(/ADMIN_INVITATION_CREATED/);
    expect(methodChunk(adminService, "generateInvitationUrl")).toMatch(
      /ADMIN_INVITATION_LINK_GENERATED/
    );
    expect(methodChunk(adminService, "inviteAdmin", 2500)).toMatch(/generateInvitationUrl/);
    expect(methodChunk(adminService, "resendInvitation")).toMatch(/ADMIN_INVITATION_RESENT/);
    expect(methodChunk(adminService, "revokeInvitation")).toMatch(/ADMIN_INVITATION_REVOKED/);
    expect(methodChunk(adminService, "acceptInvitation", 5000)).toMatch(
      /ADMIN_INVITATION_ACCEPTED/
    );

    expect(organizationService).toMatch(/ORGANIZATION_MEMBER_INVITED/);
    expect(organizationService).toMatch(/ORGANIZATION_MEMBER_JOINED/);
    expect(organizationService).toMatch(/ORGANIZATION_MEMBER_REMOVED/);
    expect(organizationService).toMatch(/ORGANIZATION_MEMBER_LEFT/);
    expect(organizationService).toMatch(/ORGANIZATION_MEMBER_ROLE_UPDATED/);
    expect(organizationService).toMatch(/ORGANIZATION_OWNERSHIP_TRANSFERRED/);
    expect(organizationService).toMatch(/ORGANIZATION_INVITATION_REVOKED/);
    expect(organizationService).toMatch(/ORGANIZATION_INVITATION_RESENT/);

    expect(methodChunk(notificationService, "updateNotificationType")).toMatch(
      /NOTIFICATION_TYPE_UPDATED/
    );
    expect(methodChunk(notificationService, "createNotificationGroup")).toMatch(
      /NOTIFICATION_GROUP_CREATED/
    );
    expect(methodChunk(notificationService, "updateNotificationGroup")).toMatch(
      /NOTIFICATION_GROUP_UPDATED/
    );
    expect(methodChunk(notificationService, "deleteNotificationGroup")).toMatch(
      /NOTIFICATION_GROUP_DELETED/
    );
    expect(methodChunk(notificationService, "updateUserPreference")).toMatch(
      /USER_NOTIFICATION_PREFERENCE_UPDATED/
    );
  });

  it("does not audit initial generateUniqueUserId assignment", () => {
    expect(userIdGenerator).not.toMatch(/writeSecurityAuditLog/);
    expect(userIdGenerator).not.toMatch(/USER_PUBLIC_ID/);
  });

  it("does not add Cognito disable/enable during deactivation audit migration", () => {
    expect(adminService).not.toMatch(/AdminDisableUser/);
    expect(adminService).not.toMatch(/AdminEnableUser/);
  });

  it("403 middleware audits ADMIN_ACCESS_DENIED non-blocking; 401s are not audited", () => {
    expect(middleware).toMatch(/writeAdminAccessDenied/);
    expect(middleware).toMatch(/INSUFFICIENT_PERMISSIONS/);
    expect(middleware).toMatch(/writeSecurityAuditLogBestEffort/);
    const unauthorizedBlocks = [...middleware.matchAll(/new AppError\(401, "UNAUTHORIZED"/g)];
    expect(unauthorizedBlocks.length).toBeGreaterThan(0);
    for (const match of unauthorizedBlocks) {
      const nearby = middleware.slice(Math.max(0, match.index! - 220), match.index! + 40);
      expect(nearby).not.toMatch(/writeAdminAccessDenied/);
    }
  });

  it("AccessAuditLog and SecurityAuditLog have no User FK and no updated_at", () => {
    const accessModel = schema.slice(
      schema.indexOf("model AccessAuditLog"),
      schema.indexOf("model SecurityAuditLog")
    );
    const securityModel = schema.slice(
      schema.indexOf("model SecurityAuditLog"),
      schema.indexOf("model corporate_individual_kyc")
    );
    expect(accessModel).not.toMatch(/@relation/);
    expect(securityModel).not.toMatch(/@relation/);
    expect(accessModel).not.toMatch(/updated_at/);
    expect(securityModel).not.toMatch(/updated_at/);
    expect(accessModel).toMatch(/metadata\s+Json/);
    expect(securityModel).toMatch(/metadata\s+Json/);
    expect(accessModel).toMatch(/subject_user_id|user_id/);
    expect(securityModel).toMatch(/subject_user_id/);
    expect(securityModel).toMatch(/actor_user_id/);
  });

  it("legacy AccessLog and SecurityLog models remain", () => {
    expect(schema).toMatch(/model AccessLog \{/);
    expect(schema).toMatch(/model SecurityLog \{/);
  });

  it("append-only: no update/delete/upsert on new audit tables in live source", () => {
    expect(liveSources).not.toMatch(/accessAuditLog\.(update|delete|deleteMany|upsert)\s*\(/);
    expect(liveSources).not.toMatch(/securityAuditLog\.(update|delete|deleteMany|upsert)\s*\(/);
  });

  it("does not introduce a canonical AuditEvent table or shared writer", () => {
    expect(schema).not.toMatch(/model AuditEvent/);
    expect(fs.existsSync(path.join(srcRoot, "lib/audit/writer.ts"))).toBe(false);
  });

  it("pure DB mutations write SecurityAuditLog inside the same Prisma transaction", () => {
    for (const [source, method] of [
      [adminService, "createAdminRole"],
      [adminService, "updateAdminRolePermissions"],
      [adminService, "deleteAdminRole"],
      [adminService, "updateUserRoles"],
      [adminService, "updateAdminRole"],
      [adminService, "deactivateAdmin"],
      [adminService, "reactivateAdmin"],
      [adminService, "revokeInvitation"],
      [adminService, "acceptInvitation"],
      [adminService, "updateUserId"],
      [notificationService, "updateNotificationType"],
      [notificationService, "createNotificationGroup"],
      [organizationService, "transferOwnership"],
    ] as const) {
      const chunk = methodChunk(source, method, 8000);
      expect(chunk).toMatch(/\$transaction/);
      expect(chunk.indexOf("$transaction")).toBeLessThan(chunk.indexOf("writeSecurityAuditLog"));
    }
  });

  it("password and email verification record the external result after Cognito outcome", () => {
    const password = methodChunk(authService, "changePassword", 6000);
    expect(password.indexOf("ChangePasswordCommand")).toBeLessThan(password.indexOf("PASSWORD_CHANGED"));
    expect(password).toMatch(/writeSecurityAuditLogBestEffort/);
    const email = methodChunk(authService, "verifyEmail", 4500);
    expect(email.indexOf("VerifyUserAttributeCommand")).toBeLessThan(email.indexOf("USER_EMAIL_VERIFIED"));
    expect(email).toMatch(/writeSecurityAuditLogBestEffort/);
  });

  it("Security UI lists every live Security event", () => {
    const panel = fs.readFileSync(
      path.join(srcRoot, "../../../apps/admin/src/components/audit/security-logs-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(/SECURITY_AUDIT_EVENTS\.map/);
    expect(panel).not.toMatch(/LOGIN|ROLE_SWITCHED|EMAIL_CHANGED/);
  });

  it("Access UI lists only signup/login/logout", () => {
    const panel = fs.readFileSync(
      path.join(srcRoot, "../../../apps/admin/src/components/audit/access-logs-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(/ACCESS_AUDIT_EVENTS\.map/);
    expect(panel).not.toMatch(/ROLE_SWITCHED|USER_COMPLETED|KYC_STATUS/);
  });

  it("Product/Legal/Notification broadcast writers stay on their own tables", () => {
    const productWriter = readSrc("modules/products/audit/writer.ts");
    const legalWriter = readSrc("modules/legal-documents/audit/writer.ts");
    const notificationWriter = readSrc("modules/notification/audit/writer.ts");
    expect(productWriter).toMatch(/productAuditLog\.create/);
    expect(legalWriter).toMatch(/legalAdminAuditLog\.create/);
    expect(notificationWriter).toMatch(/notificationBroadcastAuditLog\.create/);
    expect(productWriter).not.toMatch(/securityAuditLog/);
    expect(legalWriter).not.toMatch(/securityAuditLog/);
    expect(notificationWriter).not.toMatch(/securityAuditLog/);
  });
});
