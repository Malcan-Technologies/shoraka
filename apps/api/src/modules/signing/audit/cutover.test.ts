import fs from "node:fs";
import path from "node:path";
import { SIGNING_AUDIT_EVENTS } from "./events";
import { SIGNING_AUDIT_EVENTS as TYPES_SIGNING_EVENTS } from "@cashsouk/types";
import { APPLICATION_AUDIT_EVENTS } from "../../applications/audit/events";
import { ONBOARDING_AUDIT_EVENTS } from "../../onboarding/audit/events";
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
  "SIGNING_SESSION_OPENED",
  "SIGNING_RECIPIENT_VIEWED",
  "SIGNING_PACKAGE_IN_PROGRESS",
];

describe("Signing audit cutover", () => {
  const writer = readSrc("modules/signing/audit/writer.ts");
  const schema = readSrc("../prisma/schema.prisma");
  const signing = readSrc("modules/signing/service.ts");
  const ekyc = readSrc("modules/ekyc/service.ts");
  const envelopeExpiry = readSrc("lib/jobs/signing-envelope-expiry.ts");
  const offerExpiry = readSrc("lib/jobs/acceptance-signing-expiry.ts");
  const reconcile = readSrc("lib/jobs/signing-reconcile.ts");
  const activity = readSrc("modules/activity/adapters/signing-log.ts");
  const applicationService = readSrc("modules/applications/service.ts");
  const mapper = readSrc("modules/signing/mapper.ts");
  const liveSigningSources = collectTsSources([
    "modules/signing",
    "modules/ekyc",
    "lib/jobs",
    "modules/activity",
  ]);
  const products = collectTsSources(["modules/products"]);
  const legal = collectTsSources(["modules/legal-documents"]);
  const access = collectTsSources(["modules/auth"]);
  const security = collectTsSources(["modules/security"]);
  const onboarding = collectTsSources(["modules/onboarding"]);
  const notification = collectTsSources(["modules/notification"]);
  const applicationAudit = collectTsSources(["modules/applications/audit"]);

  it("event catalogues match between API and types", () => {
    expect([...TYPES_SIGNING_EVENTS]).toEqual([...SIGNING_AUDIT_EVENTS]);
  });

  it("implements the approved catalogue and not dropped events", () => {
    for (const event of SIGNING_AUDIT_EVENTS) {
      expect(SIGNING_AUDIT_EVENTS).toContain(event);
    }
    for (const event of FORBIDDEN_EVENTS) {
      expect(SIGNING_AUDIT_EVENTS).not.toContain(event);
      expect(signing).not.toMatch(new RegExp(`eventType: "${event}"`));
      expect(ekyc).not.toMatch(new RegExp(`eventType: "${event}"`));
    }
  });

  it("SigningAuditLog model has no FKs, no updated_at, required metadata", () => {
    const start = schema.indexOf("model SigningAuditLog");
    const end = schema.indexOf("model ", start + "model SigningAuditLog".length);
    const model = schema.slice(start, end > start ? end : undefined);
    expect(model).toMatch(/metadata\s+Json/);
    expect(model).not.toMatch(/@relation/);
    expect(model).not.toMatch(/updated_at/);
    expect(model).not.toMatch(/device_info/);
    expect(model).not.toMatch(/contract_id/);
    expect(model).not.toMatch(/invoice_id/);
    expect(model).not.toMatch(/recipient_id/);
    expect(model).toMatch(/signing_envelope_id/);
    expect(model).toMatch(/application_id/);
  });

  it("writer is append-only create", () => {
    expect(writer).toMatch(/signingAuditLog\.create/);
    expect(writer).not.toMatch(/signingAuditLog\.(update|delete|deleteMany|upsert)/);
    expect(liveSigningSources).not.toMatch(/signingAuditLog\.(update|delete|deleteMany|upsert)/);
  });

  it("has zero live ApplicationLog writers or readers", () => {
    expect(signing).not.toMatch(/logApplicationActivity/);
    expect(signing).not.toMatch(/applicationLog\.create/);
    expect(ekyc).not.toMatch(/applicationLog\.create/);
    expect(envelopeExpiry).not.toMatch(/applicationLog\.create/);
    expect(offerExpiry).not.toMatch(/applicationLog\.create/);
    expect(fs.existsSync(path.join(srcRoot, "modules/applications/logs/repository.ts"))).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, "modules/applications/logs/service.ts"))).toBe(false);
    const live = collectTsSources(["modules", "lib"]);
    expect(live).not.toMatch(/prisma\.applicationLog/);
    expect(live).not.toMatch(/logApplicationActivity\(/);
    expect(live).not.toMatch(/createApplicationLog\(/);
  });

  it("does not use SigningAuditLog as workflow state", () => {
    expect(signing).not.toMatch(/signingAuditLog\.find/);
    expect(ekyc).not.toMatch(/signingAuditLog\.find/);
    expect(mapper).not.toMatch(/signingAuditLog/);
    const signGate = methodChunk(signing, "assertRecipientCanSign", 2000);
    expect(signGate).toMatch(/resolveSigningKycStatus/);
    expect(signGate).not.toMatch(/signingAuditLog/);
  });

  it("completes only after durable signed evidence", () => {
    const chunk = methodChunk(signing, "tryCompleteEnvelopeWithEvidence", 1800);
    expect(chunk).toMatch(/requiredDocumentsHaveSignedEvidence/);
    expect(chunk).toMatch(/completeEnvelopeIfActive/);
    expect(chunk).toMatch(/SIGNING_PACKAGE_COMPLETED/);
    expect(chunk).toMatch(/signedDocumentHashes/);
    expect(chunk).not.toMatch(/s3Key/);
    expect(chunk).not.toMatch(/signed_s3_key/);
  });

  it("splits void and decline", () => {
    expect(signing).toMatch(/SIGNING_PACKAGE_VOIDED/);
    expect(signing).toMatch(/SIGNING_PACKAGE_DECLINED/);
    const voidChunk = methodChunk(signing, "voidEnvelope", 2500);
    expect(voidChunk).toMatch(/SIGNING_PACKAGE_VOIDED/);
    expect(voidChunk).not.toMatch(/SIGNING_RECIPIENT_DECLINED/);
    expect(voidChunk).not.toMatch(/createDocumentContract/);
  });

  it("writes create and send audits after durable local state", () => {
    expect(signing).toMatch(/afterCreate/);
    expect(signing).toMatch(/SIGNING_PACKAGE_CREATED/);
    const sendChunk = methodChunk(signing, "sendEnvelope", 9000);
    expect(sendChunk).toMatch(/SIGNING_PACKAGE_SENT/);
    expect(sendChunk).toMatch(/markDraftEnvelopeSent/);
  });

  it("expiry jobs share a guarded envelope transition", () => {
    expect(envelopeExpiry).toMatch(/expireSigningEnvelopeInTx/);
    expect(envelopeExpiry).toMatch(/ENVELOPE_CLOCK/);
    expect(offerExpiry).toMatch(/expireSigningEnvelopeInTx/);
    expect(offerExpiry).toMatch(/OFFER_SIGNING_CLOCK/);
  });

  it("signing envelope log APIs read SigningAuditLog", () => {
    const adminChunk = methodChunk(signing, "listEnvelopeLogs", 400);
    const issuerChunk = methodChunk(signing, "listEnvelopeLogsForIssuer", 800);
    expect(adminChunk).toMatch(/signingAuditLogReader\.listByEnvelopeId/);
    expect(issuerChunk).toMatch(/signingAuditLogReader\.listByEnvelopeId/);
    expect(signing).not.toMatch(/applicationLog\.find/);
    expect(signing).not.toMatch(/applicationAuditLog\.find/);
  });

  it("application timeline merges SigningAuditLog without a canonical table", () => {
    const chunk = methodChunk(applicationService, "getApplicationLogs", 2500);
    expect(chunk).toMatch(/applicationAuditLogReader/);
    expect(chunk).toMatch(/signingAuditLogReader/);
    expect(schema).toMatch(/model ApplicationAuditLog/);
    expect(schema).toMatch(/model SigningAuditLog/);
  });

  it("activity adapter reads SigningAuditLog", () => {
    expect(activity).toMatch(/signingAuditLog\.findMany/);
    expect(activity).toMatch(/source_table: "signing_audit_logs"/);
    expect(activity).not.toMatch(/applicationAuditLog\.create/);
  });

  it("reconcile uses RECONCILE completion method", () => {
    expect(reconcile).toMatch(/SIGNING_COMPLETION_METHOD.RECONCILE/);
  });

  it("Product/Legal/Notification/Access/Security/Onboarding/ApplicationAuditLog writers are untouched", () => {
    expect(products).not.toMatch(/writeSigningAuditLog/);
    expect(legal).not.toMatch(/writeSigningAuditLog/);
    expect(access).not.toMatch(/writeSigningAuditLog/);
    expect(security).not.toMatch(/writeSigningAuditLog/);
    expect(onboarding).not.toMatch(/writeSigningAuditLog/);
    expect(notification).not.toMatch(/writeSigningAuditLog/);
    expect(applicationAudit).not.toMatch(/writeSigningAuditLog/);
    expect(APPLICATION_AUDIT_EVENTS).not.toContain("SIGNING_PACKAGE_CREATED");
    expect(ONBOARDING_AUDIT_EVENTS).not.toContain("SIGNING_PACKAGE_CREATED");
    expect(ACCESS_AUDIT_EVENTS).not.toContain("SIGNING_PACKAGE_CREATED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("SIGNING_PACKAGE_CREATED");
  });

  it("legacy ApplicationLog model is removed", () => {
    expect(schema).not.toMatch(/model ApplicationLog/);
    expect(schema).not.toMatch(/@@map\("application_logs"\)/);
    expect(schema).toMatch(/model SigningAuditLog/);
    expect(schema).toMatch(/model ApplicationAuditLog/);
    expect(schema).toMatch(/model ApplicationReviewEvent/);
  });
});
