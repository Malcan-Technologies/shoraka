import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_SRC = join(__dirname, "..", "..");

function read(relative: string) {
  return readFileSync(join(API_SRC, relative), "utf8");
}

describe("Phase 2 forensic source: production writers", () => {
  it("Curlec webhook processing supplies webhookAuditContext", () => {
    const src = read("modules/payment/webhook-service.ts");
    expect(src).toMatch(
      /export async function processStoredCurlecWebhook[\s\S]*webhookAuditContext\(\{\s*correlationId: eventId/
    );
    expect(src).toMatch(/context: auditContext/);
    expect(src).toMatch(/function resolveCurlecCaptureAuditContext/);
  });

  it("SigningCloud callback uses webhook context without attributing the envelope creator", () => {
    const src = read("modules/signing/service.ts");
    const apply = src.slice(src.indexOf("async applyProviderContractSigned"));
    expect(apply).toMatch(/webhookAuditContext\(\)/);
    expect(apply).not.toMatch(/webhookAuditContext\(\{\s*actorUserId:/);
    expect(apply).toMatch(/syncEnvelopeFromProvider\(envelope\.id,\s*\{\s*context:/);
  });

  it("issuer-created signing packages do not inherit webhook context", () => {
    const src = read("modules/signing/service.ts");
    const created = src.slice(
      src.indexOf("ApplicationLogEventType.SIGNING_PACKAGE_CREATED"),
      src.indexOf("ApplicationLogEventType.SIGNING_PACKAGE_CREATED") + 400
    );
    expect(created).not.toMatch(/webhookAuditContext/);
    expect(created).not.toMatch(/systemAuditContext/);
  });

  it("signing reconcile job supplies systemAuditContext", () => {
    const src = read("lib/jobs/signing-reconcile.ts");
    expect(src).toMatch(/systemAuditContext\(\{\s*correlationId: "cron:signing-reconcile"/);
    expect(src).toMatch(/syncEnvelopeFromProvider\(row\.id,\s*\{\s*context: jobContext/);
  });

  it("stuck-order poller supplies systemAuditContext to expiry and recovery writers", () => {
    const src = read("lib/jobs/gateway-stuck-order-poller.ts");
    expect(src).toMatch(/systemAuditContext\(\{\s*correlationId: CRON_CORRELATION_ID/);
    expect(src).toMatch(/syncGatewayPaymentFromCurlec\(payment, db, context\)/);
    expect(src).toMatch(/recoverHeldAmountMismatchRefunds\(db, 50, pollerContext\)/);
    expect(src).toMatch(/reconcilePendingGatewayRefunds\(db, 50, pollerContext\)/);
    expect(src).toMatch(/recoverFailedWalletReversals\(db, 50, pollerContext\)/);
  });

  it("COD URL_GENERATED amendment logs previous/new status with webhook context", () => {
    const src = read("modules/regtank/webhooks/cod-handler.ts");
    const block = src.slice(src.indexOf('statusUpper === "URL_GENERATED"'));
    expect(block).toMatch(/eventType:\s*"ONBOARDING_STATUS_UPDATED"/);
    expect(block).toMatch(/eventType:\s*"ONBOARDING_AMENDMENT_REQUIRED"/);
    expect(block).toMatch(/trigger:\s*"COD_URL_GENERATED"/);
    expect(block).toMatch(/previousStatus/);
    expect(block).toMatch(/newStatus/);
    expect(block).toMatch(/context:\s*webhookAuditContext\(\)/);
  });

  it("RegTank webhook handlers still pass webhookAuditContext", () => {
    expect(read("modules/regtank/service.ts")).toMatch(/context: webhookAuditContext\(\)/);
    expect(read("modules/regtank/webhooks/kyc-handler.ts")).toMatch(/context: webhookAuditContext\(\)/);
    expect(read("modules/regtank/webhooks/cod-handler.ts")).toMatch(/context: webhookAuditContext\(\)/);
    expect(read("modules/regtank/webhooks/individual-onboarding-handler.ts")).toMatch(
      /context: webhookAuditContext\(\)/
    );
    expect(read("modules/regtank/webhooks/eod-handler.ts")).toMatch(/context: webhookAuditContext\(\)/);
    expect(read("modules/regtank/webhooks/eod-handler.ts")).not.toMatch(/portal:\s*portalType/);
  });

  it("CTOS financial reset does not use a sentinel user id", () => {
    const src = read("modules/ctos/ctos-report-service.ts");
    expect(src).not.toMatch(/userId:\s*"system"/);
    expect(src).toMatch(/userId:\s*null/);
    expect(src).toMatch(/internalAuditContext\(\)/);
    expect(src).toMatch(/source:\s*AUDIT_SOURCE\.INTERNAL/);
  });

  it("admin onboarding cancel/reset attributes the Admin actor on the Admin portal", () => {
    const src = read("modules/admin/service.ts");
    expect(src).toMatch(/eventType:\s*"ONBOARDING_RESET"/);
    expect(src).toMatch(/eventType:\s*"ONBOARDING_CANCELLED"/);
    expect(src).toMatch(/portal:\s*AUDIT_PORTAL\.ADMIN/);
    expect(src).toMatch(/source:\s*AUDIT_SOURCE\.API/);
    expect(src).toMatch(/actorUserId:\s*adminUserId/);
  });

  it("admin onboarding refresh attributes the Admin actor on the Admin portal", () => {
    const src = read("modules/admin/service.ts");
    const refresh = src.slice(src.indexOf("ADMIN_MANUAL_ONBOARDING_REFRESH"));
    expect(refresh).toMatch(/portal:\s*AUDIT_PORTAL\.ADMIN/);
    expect(src).toMatch(/actorUserId:\s*adminUserId/);
  });

  it("signing envelope expiry job uses systemAuditContext", () => {
    const src = read("lib/jobs/signing-envelope-expiry.ts");
    expect(src).toMatch(/systemAuditContext\(\{\s*correlationId: EXPIRY_CORRELATION_ID/);
    expect(src).toMatch(/signingService\.expireEnvelope\(envelope\.id,\s*\{\s*context/);
  });

  it("scheduled expiry jobs remain SYSTEM_JOB", () => {
    expect(read("lib/jobs/acceptance-signing-expiry.ts")).toMatch(/systemAuditContext\(/);
    expect(read("lib/jobs/note-listing-expiry.ts")).toMatch(/systemAuditContext\(/);
  });

  it("admin assignment-notice writes remain API", () => {
    const src = read("modules/paymaster/assignment-notice.service.ts");
    expect(src).toMatch(/source: AUDIT_SOURCE\.API/);
    expect(src).not.toMatch(/WEBHOOK|SYSTEM_JOB|INTERNAL/);
  });

  it("Shoraka admin-triggered notes store API, not INTERNAL", () => {
    const src = read("modules/shoraka-stp/shoraka-stp-service.ts");
    expect(src).toMatch(/source: AUDIT_SOURCE\.API/);
    expect(src).not.toMatch(/source: AUDIT_SOURCE\.INTERNAL/);
  });

  it("facility occupancy remains INTERNAL as a derived side-effect", () => {
    const src = read("lib/refresh-contract-facility.ts");
    const occupancy = src.slice(src.indexOf("recordFacilityOccupancyAudit"));
    expect(occupancy).toMatch(/CONTRACT_FACILITY_OCCUPANCY_UPDATED[\s\S]*source: AUDIT_SOURCE\.INTERNAL/);
    expect(occupancy).toMatch(/FACILITY_OCCUPANCY_UPDATED[\s\S]*source: AUDIT_SOURCE\.INTERNAL/);
  });
});
