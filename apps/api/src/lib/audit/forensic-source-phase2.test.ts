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

  it("SigningCloud callback syncs with webhookAuditContext even when a creator user id exists", () => {
    const src = read("modules/signing/service.ts");
    const apply = src.slice(src.indexOf("async applyProviderContractSigned"));
    expect(apply).toMatch(/webhookAuditContext\(\{\s*actorUserId: envelope\.created_by_user_id/);
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

  it("RegTank webhook handlers still pass webhookAuditContext", () => {
    expect(read("modules/regtank/service.ts")).toMatch(/context: webhookAuditContext\(\)/);
    expect(read("modules/regtank/webhooks/kyc-handler.ts")).toMatch(/context: webhookAuditContext\(\)/);
    expect(read("modules/regtank/webhooks/cod-handler.ts")).toMatch(/context: webhookAuditContext\(\)/);
    expect(read("modules/regtank/webhooks/individual-onboarding-handler.ts")).toMatch(
      /context: webhookAuditContext\(\)/
    );
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
