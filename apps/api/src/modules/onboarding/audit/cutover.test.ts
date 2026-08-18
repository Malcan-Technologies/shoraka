import fs from "node:fs";
import path from "node:path";
import { ONBOARDING_AUDIT_EVENTS, RETIRED_ONBOARDING_AUDIT_EVENTS } from "./events";
import { ONBOARDING_AUDIT_EVENTS as TYPES_ONBOARDING_EVENTS } from "@cashsouk/types";
import { ACCESS_AUDIT_EVENTS } from "../../auth/audit/events";
import { SECURITY_AUDIT_EVENTS } from "../../security/audit/events";

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

const FORBIDDEN_EVENTS = [
  "ONBOARDING_CANCELLED",
  "TNC_ACCEPTED",
  "TNC_APPROVED",
  "KYC_STATUS_UPDATED",
  "KYB_STATUS_UPDATED",
  "KYT_STATUS_UPDATED",
  "WEBHOOK_RECEIVED",
  "WEBHOOK_APPROVED",
  "FORM_FILLED",
  "EOD_WEBHOOK",
  "EOD_APPROVED",
  "CTOS_REPORT_REQUESTED",
  "COD_REJECTED",
];

describe("Onboarding audit cutover", () => {
  const writer = readSrc("modules/onboarding/audit/writer.ts");
  const authService = readSrc("modules/auth/service.ts");
  const adminService = readSrc("modules/admin/service.ts");
  const organizationService = readSrc("modules/organization/service.ts");
  const schema = readSrc("../prisma/schema.prisma");
  const liveSources = collectTsSources([
    "modules/auth",
    "modules/admin",
    "modules/organization",
    "modules/regtank",
    "modules/ctos",
    "modules/activity",
    "modules/onboarding",
    "modules/payment",
  ]);

  it("event catalogues match between API and types", () => {
    expect([...TYPES_ONBOARDING_EVENTS]).toEqual([...ONBOARDING_AUDIT_EVENTS]);
    expect(ONBOARDING_AUDIT_EVENTS).toHaveLength(18);
    expect([...RETIRED_ONBOARDING_AUDIT_EVENTS]).toEqual([
      "ONBOARDING_RESUMED",
      "CTOS_REPORT_RECEIVED",
      "CORPORATE_ENTITIES_UPDATED",
    ]);
  });

  it("does not implement dropped events", () => {
    for (const event of FORBIDDEN_EVENTS) {
      expect(ONBOARDING_AUDIT_EVENTS).not.toContain(event);
    }
  });

  it("cancelOnboarding does not read OnboardingLog or OnboardingAuditLog as state", () => {
    const chunk = methodChunk(authService, "cancelOnboarding", 2500);
    expect(chunk).not.toMatch(/onboardingLog\.find/);
    expect(chunk).not.toMatch(/onboardingAuditLog\.find/);
    expect(authService).toMatch(/hasIncompleteOnboardingForRole/);
    expect(authService).toMatch(/onboarding_status/);
    expect(authService).toMatch(/regTankOnboarding\.findMany/);
  });

  it("logout still wraps cancelOnboarding", () => {
    const chunk = methodChunk(authService, "logout", 2500);
    expect(chunk).toMatch(/cancelOnboarding/);
    expect(chunk).toMatch(/Failed to cancel onboarding during logout/);
  });

  it("OnboardingAuditLog model has no FKs, no updated_at, required metadata", () => {
    const start = schema.indexOf("model OnboardingAuditLog");
    const end = schema.indexOf("model corporate_individual_kyc");
    const model = schema.slice(start, end);
    expect(model).toMatch(/metadata\s+Json/);
    expect(model).not.toMatch(/@relation/);
    expect(model).not.toMatch(/updated_at/);
    expect(model).not.toMatch(/device_info/);
  });

  it("writer is append-only create", () => {
    expect(writer).toMatch(/onboardingAuditLog\.create/);
    expect(writer).not.toMatch(/onboardingAuditLog\.(update|delete|deleteMany|upsert)/);
    expect(liveSources).not.toMatch(/onboardingAuditLog\.(update|delete|deleteMany|upsert)/);
  });

  it("live writers do not create OnboardingLog rows", () => {
    expect(adminService).not.toMatch(/prisma\.onboardingLog\.create/);
    expect(adminService).not.toMatch(/createOnboardingLog\(/);
    expect(organizationService).not.toMatch(/createOnboardingLog\(/);
    expect(organizationService).not.toMatch(/prisma\.onboardingLog\.create/);
    expect(liveSources).not.toMatch(/prisma\.onboardingLog\.create/);
    expect(liveSources).not.toMatch(/prismaDev\.onboardingLog\.create/);
    expect(liveSources).not.toMatch(/prisma\.onboardingLog\.find/);
  });

  it("live readers do not query OnboardingLog", () => {
    const activity = readSrc("modules/activity/adapters/organization-log.ts");
    expect(activity).toMatch(/onboardingAuditLog\.findMany/);
    expect(activity).not.toMatch(/onboardingLog\.find/);
    expect(adminService).not.toMatch(/prisma\.onboardingLog\.find/);
    expect(authService).not.toMatch(/prisma\.onboardingLog\.find/);
  });

  it("TNC acceptance does not write OnboardingAuditLog", () => {
    const chunk = methodChunk(organizationService, "acceptTnc", 4000);
    expect(chunk).not.toMatch(/writeOnboardingAuditLog/);
    expect(chunk).not.toMatch(/TNC_APPROVED|TNC_ACCEPTED/);
  });

  it("legacy complete-onboarding writes ONBOARDING_COMPLETED", () => {
    const chunk = methodChunk(organizationService, "completeOnboarding", 5000);
    expect(chunk).toMatch(/ONBOARDING_COMPLETED/);
    expect(chunk).toMatch(/LEGACY_COMPLETE_ONBOARDING/);
    expect(chunk).not.toMatch(/ONBOARDING_FINAL_APPROVAL_COMPLETED/);
  });

  it("admin final approval writes ONBOARDING_FINAL_APPROVAL_COMPLETED", () => {
    const chunk = methodChunk(adminService, "completeFinalApproval", 9000);
    expect(chunk).toMatch(/ONBOARDING_FINAL_APPROVAL_COMPLETED/);
    expect(chunk).not.toMatch(/ONBOARDING_COMPLETED/);
  });

  it("admin restart writes ONBOARDING_RESTARTED not ONBOARDING_CANCELLED", () => {
    const chunk = methodChunk(adminService, "restartOnboarding", 9000);
    expect(chunk).toMatch(/ONBOARDING_RESTARTED/);
    expect(chunk).toMatch(/ADMIN_RESTART/);
    expect(chunk).not.toMatch(/ONBOARDING_CANCELLED/);
  });

  it("Product/Legal/Notification/Access/Security catalogues stay distinct", () => {
    expect(ACCESS_AUDIT_EVENTS).not.toEqual(expect.arrayContaining([...ONBOARDING_AUDIT_EVENTS]));
    expect(SECURITY_AUDIT_EVENTS).not.toContain("ONBOARDING_STARTED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("AML_APPROVED");
  });

  it("OnboardingLog Prisma model and onboarding_logs table mapping are removed", () => {
    expect(schema).not.toMatch(/model OnboardingLog/);
    expect(schema).not.toMatch(/@@map\("onboarding_logs"\)/);
    expect(schema).toMatch(/model OnboardingAuditLog/);
    expect(schema).toMatch(/@@map\("onboarding_audit_logs"\)/);
  });

  it("writes the approved event catalogue from live modules", () => {
    expect(adminService).toMatch(/ONBOARDING_RESET/);
    expect(adminService).toMatch(/USER_ONBOARDING_STATUS_UPDATED/);
    expect(adminService).toMatch(/ONBOARDING_FINAL_APPROVAL_COMPLETED/);
    expect(adminService).toMatch(/ONBOARDING_APPROVED/);
    expect(adminService).toMatch(/AML_APPROVED/);
    expect(adminService).toMatch(/SSM_APPROVED/);
    expect(adminService).toMatch(/INVESTOR_SOPHISTICATED_STATUS_UPDATED/);
    expect(adminService).toMatch(/writeDirectorKycOutcomeAuditLogs/);
    expect(adminService).not.toMatch(/eventType:\s*"CORPORATE_ENTITIES_UPDATED"/);
    expect(liveSources).toMatch(/ONBOARDING_STARTED/);
    expect(liveSources).not.toMatch(/eventType:\s*"ONBOARDING_RESUMED"/);
    expect(liveSources).not.toMatch(/eventType:\s*"CORPORATE_ENTITIES_UPDATED"/);
    expect(liveSources).not.toMatch(/eventType:\s*"CTOS_REPORT_RECEIVED"/);
    expect(liveSources).not.toMatch(/writeCtosReportReceivedAudit/);
    expect(liveSources).toMatch(/DIRECTOR_ONBOARDING_INVITATION_SENT/);
    expect(liveSources).toMatch(/ORGANIZATION_PROFILE_UPDATED_BY_ADMIN/);
    expect(liveSources).toMatch(/ONBOARDING_REJECTED/);
  });

  it("reset writes user-account-marker metadata and does not rewind org SOT in that method", () => {
    const chunk = methodChunk(adminService, "resetOnboarding", 5000);
    expect(chunk).toMatch(/statusScope: "USER_ACCOUNT_MARKER"/);
    expect(chunk).toMatch(/organizationStateReset: false/);
    expect(chunk).not.toMatch(/onboarding_status:/);
  });

  it("SSM approval does not also emit ONBOARDING_STATUS_CHANGED", () => {
    const chunk = methodChunk(adminService, "approveSsmVerification", 9000);
    expect(chunk).toMatch(/SSM_APPROVED/);
    expect(chunk).not.toMatch(/ONBOARDING_STATUS_CHANGED/);
  });

  it("admin onboarding approval does not also emit ONBOARDING_STATUS_CHANGED", () => {
    const chunk = methodChunk(adminService, "approveOnboardingSubmission", 9000);
    expect(chunk).toMatch(/ONBOARDING_APPROVED/);
    expect(chunk).not.toMatch(/ONBOARDING_STATUS_CHANGED/);
  });

  it("AML approval does not also emit ONBOARDING_STATUS_CHANGED", () => {
    const chunk = methodChunk(adminService, "approveAmlScreening", 8000);
    expect(chunk).toMatch(/AML_APPROVED/);
    expect(chunk).toMatch(/onboardingId,/);
    expect(chunk).not.toMatch(/ONBOARDING_STATUS_CHANGED/);
  });

  it("final approval does not emit ONBOARDING_STATUS_CHANGED or CORPORATE_ENTITIES_UPDATED", () => {
    const chunk = methodChunk(adminService, "completeFinalApproval", 30000);
    expect(chunk).toMatch(/ONBOARDING_FINAL_APPROVAL_COMPLETED/);
    expect(chunk).not.toMatch(/ONBOARDING_STATUS_CHANGED/);
    expect(chunk).not.toMatch(/CORPORATE_ENTITIES_UPDATED/);
  });

  it("COD URL_GENERATED writes ONBOARDING_STATUS_CHANGED for amendment", () => {
    const cod = readSrc("modules/regtank/webhooks/cod-handler.ts");
    expect(cod).toMatch(/statusUpper === "URL_GENERATED"/);
    expect(cod).toMatch(/trigger:\s*"URL_GENERATED"/);
    expect(cod).toMatch(/eventType:\s*"ONBOARDING_STATUS_CHANGED"/);
  });

  it("KYC/KYB/KYT raw callbacks do not invent status events", () => {
    const kyc = readSrc("modules/regtank/webhooks/kyc-handler.ts");
    const kyb = readSrc("modules/regtank/webhooks/kyb-handler.ts");
    const kyt = readSrc("modules/regtank/webhooks/kyt-handler.ts");
    for (const source of [kyc, kyb, kyt]) {
      expect(source).not.toMatch(/writeOnboardingAuditLog/);
      expect(source).not.toMatch(/KYC_STATUS_UPDATED|KYB_STATUS_UPDATED|KYT_STATUS_UPDATED/);
    }
  });

  it("TNC, guarantor AML, and onboarding fee do not write OnboardingAuditLog", () => {
    const tnc = methodChunk(organizationService, "acceptTnc", 4000);
    expect(tnc).not.toMatch(/writeOnboardingAuditLog/);
    expect(liveSources).not.toMatch(/GUARANTOR_AML/);
    const payment = collectTsSources(["modules/payment"]);
    expect(payment).not.toMatch(/writeOnboardingAuditLog/);
    expect(payment).not.toMatch(/onboardingAuditLog\.create/);
  });

  it("raw WEBHOOK_/FORM_FILLED/EOD_WEBHOOK events are not written", () => {
    expect(liveSources).not.toMatch(/eventType:\s*"WEBHOOK_/);
    expect(liveSources).not.toMatch(/eventType:\s*"FORM_FILLED"/);
    expect(liveSources).not.toMatch(/eventType:\s*"EOD_WEBHOOK"/);
    expect(liveSources).not.toMatch(/eventType:\s*"EOD_APPROVED"/);
  });

  it("readers map userId to subject_user_id and export from OnboardingAuditLog", () => {
    const reader = readSrc("modules/onboarding/audit/reader.ts");
    expect(reader).toMatch(/subject_user_id = params\.userId/);
    expect(reader).toMatch(/organization_id = params\.organizationId/);
    expect(reader).toMatch(/formatDeviceInfoFromUserAgent/);
    expect(reader).toMatch(/findAllForExport/);
    expect(adminService).toMatch(/onboardingAuditLogReader\.findAll/);
    expect(adminService).toMatch(/onboardingAuditLogReader\.findById/);
    expect(adminService).toMatch(/onboardingAuditLogReader\.findAllForExport/);
  });

  it("shared actor vocabulary includes SYSTEM and INTEGRATION", () => {
    const context = readSrc("lib/audit/context.ts");
    expect(context).toMatch(/SYSTEM:/);
    expect(context).toMatch(/INTEGRATION:/);
    expect(context).toMatch(/webhookAuditContext/);
    expect(context).toMatch(/systemAuditContext/);
  });

  it("writer is fail-closed with no swallowed create errors", () => {
    expect(writer).not.toMatch(/catch \(/);
    expect(writer).not.toMatch(/BestEffort/);
  });

  it("Product/Legal/Notification writers are untouched by the onboarding cutover", () => {
    const productWriter = readSrc("modules/products/audit/writer.ts");
    const legalWriter = readSrc("modules/legal-documents/audit/writer.ts");
    const notificationWriter = readSrc("modules/notification/audit/writer.ts");
    expect(productWriter).not.toMatch(/onboardingAuditLog/);
    expect(legalWriter).not.toMatch(/onboardingAuditLog/);
    expect(notificationWriter).not.toMatch(/onboardingAuditLog/);
  });
});
