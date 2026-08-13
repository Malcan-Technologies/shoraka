import fs from "node:fs";
import path from "node:path";
import { APPLICATION_AUDIT_EVENTS } from "./events";
import { APPLICATION_AUDIT_EVENTS as TYPES_APPLICATION_EVENTS } from "@cashsouk/types";
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
  "APPLICATION_APPROVED",
  "APPLICATION_CLASSIFICATION_UPDATED",
  "BOARD_RESOLUTION_UPLOADED",
  "BOARD_RESOLUTION_REMOVED",
  "NOTE_CREATED",
  "SIGNING_PACKAGE_CREATED",
  "SIGNING_PACKAGE_SENT",
  "SIGNING_PACKAGE_COMPLETED",
  "SIGNING_PACKAGE_VOIDED",
];

describe("Application audit cutover", () => {
  const writer = readSrc("modules/applications/audit/writer.ts");
  const schema = readSrc("../prisma/schema.prisma");
  const adminService = readSrc("modules/admin/service.ts");
  const applicationService = readSrc("modules/applications/service.ts");
  const amendments = readSrc("modules/applications/amendments/service.ts");
  const contracts = readSrc("modules/contracts/service.ts");
  const invoices = readSrc("modules/invoices/service.ts");
  const signing = readSrc("modules/signing/service.ts");
  const notes = collectTsSources(["modules/notes"]);
  const payment = collectTsSources(["modules/payment"]);
  const products = collectTsSources(["modules/products"]);
  const legal = collectTsSources(["modules/legal-documents"]);
  const access = collectTsSources(["modules/auth"]);
  const security = collectTsSources(["modules/security"]);
  const onboarding = collectTsSources(["modules/onboarding"]);
  const notification = collectTsSources(["modules/notification"]);
  const liveApplicationSources = collectTsSources([
    "modules/applications",
    "modules/admin",
    "modules/contracts",
    "modules/invoices",
    "modules/ctos",
    "modules/activity",
    "lib/jobs",
  ]);

  it("event catalogues match between API and types", () => {
    expect([...TYPES_APPLICATION_EVENTS]).toEqual([...APPLICATION_AUDIT_EVENTS]);
  });

  it("does not implement dropped events", () => {
    for (const event of FORBIDDEN_EVENTS) {
      expect(APPLICATION_AUDIT_EVENTS).not.toContain(event);
    }
  });

  it("ApplicationAuditLog model has no FKs, no updated_at, required metadata", () => {
    const start = schema.indexOf("model ApplicationAuditLog");
    const end = schema.indexOf("model ", start + "model ApplicationAuditLog".length);
    const model = schema.slice(start, end > start ? end : undefined);
    expect(model).toMatch(/metadata\s+Json/);
    expect(model).not.toMatch(/@relation/);
    expect(model).not.toMatch(/updated_at/);
    expect(model).not.toMatch(/device_info/);
    expect(model).not.toMatch(/contract_id/);
    expect(model).not.toMatch(/invoice_id/);
  });

  it("writer is append-only create", () => {
    expect(writer).toMatch(/applicationAuditLog\.create/);
    expect(writer).not.toMatch(/applicationAuditLog\.(update|delete|deleteMany|upsert)/);
    expect(liveApplicationSources).not.toMatch(/applicationAuditLog\.(update|delete|deleteMany|upsert)/);
  });

  it("ApplicationReviewRemark is cycle-scoped", () => {
    expect(schema).toMatch(/@@unique\(\[application_id, review_cycle, scope, scope_key\]/);
    expect(amendments).toMatch(/review_cycle: previousCycle/);
    expect(amendments).toMatch(/submitted_at: null/);
  });

  it("resubmit comparison reads remarks SOT and never audit/log state", () => {
    const chunk = methodChunk(adminService, "getResubmitComparisonSnapshots", 4000);
    expect(chunk).toMatch(/applicationReviewRemark\.findMany/);
    expect(chunk).not.toMatch(/applicationLog\.find/);
    expect(chunk).not.toMatch(/applicationAuditLog\.find/);
  });

  it("application-domain writers no longer create ApplicationLog rows", () => {
    expect(applicationService).not.toMatch(/logApplicationActivity/);
    expect(applicationService).not.toMatch(/applicationLog\.create/);
    expect(adminService).not.toMatch(/logApplicationActivity/);
    expect(adminService).not.toMatch(/applicationLog\.create/);
    expect(amendments).not.toMatch(/applicationLog\.create/);
    expect(contracts).not.toMatch(/logApplicationActivity/);
    expect(invoices).not.toMatch(/logApplicationActivity/);
  });

  it("signing no longer writes ApplicationLog", () => {
    expect(signing).not.toMatch(/logApplicationActivity/);
    expect(signing).not.toMatch(/applicationLog\.create/);
    expect(signing).toMatch(/writeSigningAuditLog/);
    expect(signing).not.toMatch(/writeApplicationAuditLog/);
  });

  it("history readers use ApplicationAuditLog and merge SigningAuditLog", () => {
    expect(applicationService).toMatch(/applicationAuditLogReader/);
    expect(applicationService).toMatch(/signingAuditLogReader/);
    const activity = readSrc("modules/activity/adapters/application-log.ts");
    expect(activity).toMatch(/applicationAuditLog\.findMany/);
    expect(activity).not.toMatch(/prisma\.applicationLog\.find/);
    expect(activity).not.toMatch(/SIGNING_PACKAGE_/);
  });

  it("note and payment modules do not write ApplicationAuditLog", () => {
    expect(notes).not.toMatch(/writeApplicationAuditLog/);
    expect(payment).not.toMatch(/writeApplicationAuditLog/);
  });

  it("Product/Legal/Notification/Access/Security/Onboarding modules are untouched by this writer", () => {
    expect(products).not.toMatch(/writeApplicationAuditLog/);
    expect(legal).not.toMatch(/writeApplicationAuditLog/);
    expect(access).not.toMatch(/writeApplicationAuditLog/);
    expect(security).not.toMatch(/writeApplicationAuditLog/);
    expect(onboarding).not.toMatch(/writeApplicationAuditLog/);
    expect(notification).not.toMatch(/writeApplicationAuditLog/);
    expect(ONBOARDING_AUDIT_EVENTS).not.toContain("APPLICATION_CREATED");
    expect(ACCESS_AUDIT_EVENTS).not.toContain("APPLICATION_CREATED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("APPLICATION_CREATED");
  });

  it("legacy ApplicationLog model, table mapping, and helper module are removed", () => {
    expect(schema).not.toMatch(/model ApplicationLog/);
    expect(schema).not.toMatch(/@@map\("application_logs"\)/);
    expect(schema).toMatch(/model ApplicationAuditLog/);
    expect(schema).toMatch(/@@map\("application_audit_logs"\)/);
    expect(schema).toMatch(/model SigningAuditLog/);
    expect(schema).toMatch(/model ApplicationReviewEvent/);
    expect(fs.existsSync(path.join(srcRoot, "modules/applications/logs/repository.ts"))).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, "modules/applications/logs/service.ts"))).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, "modules/applications/logs/types.ts"))).toBe(false);
    expect(liveApplicationSources).not.toMatch(/prisma\.applicationLog/);
    expect(liveApplicationSources).not.toMatch(/logApplicationActivity/);
    expect(liveApplicationSources).not.toMatch(/createApplicationLog/);
  });

  it("implements the approved application lifecycle events", () => {
    expect(applicationService).toMatch(/eventType: "APPLICATION_CREATED"/);
    expect(applicationService).toMatch(/eventType: "APPLICATION_SUBMITTED"/);
    expect(adminService).toMatch(/eventType: "APPLICATION_REVIEW_STARTED"/);
    expect(amendments).toMatch(/eventType: "APPLICATION_RESUBMITTED"/);
    expect(amendments).toMatch(/eventType: "APPLICATION_AMENDMENT_ACKNOWLEDGED"/);
    expect(adminService).toMatch(/eventType: "APPLICATION_AMENDMENTS_REQUESTED"/);
    expect(adminService).toMatch(/eventType: "APPLICATION_REOPENED_FOR_REVIEW"/);
    expect(applicationService).toMatch(/eventType: "APPLICATION_WITHDRAWN"/);
    expect(applicationService).toMatch(/eventType: "APPLICATION_REJECTED"/);
    expect(applicationService).toMatch(/eventType: "APPLICATION_ARCHIVED"/);
    expect(applicationService).toMatch(/eventType: "APPLICATION_DRAFT_DELETED"/);
    expect(applicationService).toMatch(/eventType: "APPLICATION_COMPLETED"/);
  });

  it("writes APPLICATION_RESUBMITTED once in amendments, not via PATCH status", () => {
    const resubmitCount = (amendments.match(/eventType: "APPLICATION_RESUBMITTED"/g) ?? []).length;
    expect(resubmitCount).toBe(1);
    const statusChunk = methodChunk(applicationService, "updateApplicationStatus", 9000);
    expect(statusChunk).not.toMatch(/APPLICATION_RESUBMITTED/);
  });

  it("review updates skip no-ops and do not audit draft remarks", () => {
    expect(adminService).toMatch(/if \(previousStatus === newStatus\) return/);
    expect(adminService).toMatch(/includeSubmittedRemarks && newStatus === "AMENDMENT_REQUESTED"/);
    expect(adminService).toMatch(/addPendingAmendment/);
    const pendingChunk = methodChunk(adminService, "addPendingAmendment", 6000);
    expect(pendingChunk).not.toMatch(/logReviewActivity/);
    expect(pendingChunk).not.toMatch(/writeApplicationAuditLog/);
    const commentChunk = methodChunk(adminService, "addSectionComment", 1500);
    expect(commentChunk).not.toMatch(/writeApplicationAuditLog/);
  });

  it("draft delete writes audit in the same transaction before deleting Application", () => {
    const chunk = methodChunk(applicationService, "deleteDraftApplication", 5000);
    const auditIdx = chunk.indexOf("APPLICATION_DRAFT_DELETED");
    const deleteIdx = chunk.indexOf("tx.application.delete");
    expect(auditIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(auditIdx);
  });

  it("contract reject audits CONTRACT_OFFER_REJECTED, not CONTRACT_WITHDRAWN", () => {
    expect(applicationService).toMatch(/eventType: "CONTRACT_OFFER_REJECTED"/);
    const rejectChunk = applicationService.slice(
      applicationService.indexOf('eventType: "CONTRACT_OFFER_REJECTED"'),
      applicationService.indexOf('eventType: "CONTRACT_OFFER_REJECTED"') + 800
    );
    expect(rejectChunk).toMatch(/withdrawReason: "OFFER_REJECTED"/);
    expect(rejectChunk).not.toMatch(/CONTRACT_WITHDRAWN/);
  });

  it("offer accepted distinguishes direct vs signing completion", () => {
    expect(applicationService).toMatch(/DIRECT_ACCEPTANCE/);
    expect(applicationService).toMatch(/SIGNING_COMPLETION/);
    expect(applicationService).toMatch(/AUDIT_ACTOR_TYPE.SYSTEM/);
    expect(signing).toMatch(/SIGNING_PACKAGE_/);
    expect(signing).not.toMatch(/writeApplicationAuditLog/);
  });

  it("expiry persists OFFER_EXPIRED and writes audit in the same awaited transaction", () => {
    const expiry = readSrc("lib/jobs/acceptance-signing-expiry.ts");
    expect(expiry).toMatch(/writeApplicationAuditLog/);
    expect(expiry).toMatch(/CONTRACT_OFFER_EXPIRED/);
    expect(expiry).toMatch(/INVOICE_OFFER_EXPIRED/);
    expect(expiry).not.toMatch(/logApplicationActivity/);
  });

  it("does not use ApplicationAuditLog as workflow state", () => {
    expect(amendments).not.toMatch(/applicationAuditLog\.find/);
    expect(applicationService).not.toMatch(/applicationAuditLog\.find/);
    expect(adminService).not.toMatch(/applicationAuditLog\.find/);
  });
});
