import fs from "node:fs";
import path from "node:path";
import { NOTE_AUDIT_EVENTS } from "./events";
import { NOTE_AUDIT_EVENTS as TYPES_NOTE_EVENTS } from "@cashsouk/types";
import { APPLICATION_AUDIT_EVENTS } from "../../applications/audit/events";
import { SIGNING_AUDIT_EVENTS } from "../../signing/audit/events";
import { ONBOARDING_AUDIT_EVENTS } from "../../onboarding/audit/events";
import { ACCESS_AUDIT_EVENTS } from "../../auth/audit/events";
import { SECURITY_AUDIT_EVENTS } from "../../security/audit/events";
import { PRODUCT_AUDIT_EVENTS } from "../../products/audit/events";
import { LEGAL_ADMIN_AUDIT_EVENTS } from "../../legal-documents/audit/events";
import { NOTIFICATION_BROADCAST_AUDIT_EVENTS } from "../../notification/audit/events";

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
  "NOTE_VISIBILITY_UPDATED",
  "NOTE_PROSPECTUS_PUBLISHED",
  "NOTE_CREATED_FROM_INVOICE",
  "PROSPECTUS_REVIEW_DRAFT_UPDATE",
  "LATE_CHARGE_APPROVED",
  "OVERDUE_LATE_CHARGE_CHECKED",
  "SERVICE_FEE_CALCULATED",
  "SERVICE_FEE_APPROVED",
  "SERVICE_FEE_POSTED",
  "SHORAKA_ORDER_CREATED",
  "SHORAKA_ORDER_COMPLETED",
  "SHORAKA_ORDER_FAILED",
  "SHORAKA_CERTIFICATE_FETCHED",
  "PLATFORM_FINANCE_SETTINGS_UPDATED",
  "REPAYMENT_POSTED",
];

describe("Note audit cutover", () => {
  const writer = readSrc("modules/notes/audit/writer.ts");
  const schema = readSrc("../prisma/schema.prisma");
  const notes = readSrc("modules/notes/service.ts");
  const prospectus = readSrc("modules/notes/prospectus-review/prospectus-review.service.ts");
  const shoraka = readSrc("modules/shoraka-stp/shoraka-stp-service.ts");
  const mapper = readSrc("modules/notes/mapper.ts");
  const repository = readSrc("modules/notes/repository.ts");
  const activity = readSrc("modules/activity/adapters/note-log.ts");
  const liveNoteSources = collectTsSources([
    "modules/notes",
    "modules/shoraka-stp",
    "modules/activity",
  ]);
  const products = collectTsSources(["modules/products"]);
  const legal = collectTsSources(["modules/legal-documents"]);
  const access = collectTsSources(["modules/auth"]);
  const security = collectTsSources(["modules/security"]);
  const onboarding = collectTsSources(["modules/onboarding"]);
  const notification = collectTsSources(["modules/notification"]);
  const applicationAudit = collectTsSources(["modules/applications/audit"]);
  const signingAudit = collectTsSources(["modules/signing/audit"]);

  it("event catalogues match between API and types", () => {
    expect([...TYPES_NOTE_EVENTS]).toEqual([...NOTE_AUDIT_EVENTS]);
  });

  it("implements the approved catalogue and not dropped events", () => {
    for (const event of FORBIDDEN_EVENTS) {
      expect(NOTE_AUDIT_EVENTS).not.toContain(event);
      expect(notes).not.toMatch(new RegExp(`eventType: "${event}"`));
      expect(prospectus).not.toMatch(new RegExp(`eventType: "${event}"`));
      expect(shoraka).not.toMatch(new RegExp(`eventType: "${event}"`));
    }
  });

  it("NoteAuditLog model has no FKs, no updated_at, required metadata", () => {
    const start = schema.indexOf("model NoteAuditLog");
    const end = schema.indexOf("model ", start + "model NoteAuditLog".length);
    const model = schema.slice(start, end > start ? end : undefined);
    expect(model).toMatch(/metadata\s+Json/);
    expect(model).not.toMatch(/@relation/);
    expect(model).not.toMatch(/updated_at/);
    expect(model).not.toMatch(/device_info/);
    expect(model).toMatch(/note_id\s+String\?/);
    expect(model).toMatch(/@@index\(\[note_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[event_type, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[organization_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[actor_user_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[target_type, target_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[correlation_id\]\)/);
  });

  it("writer is append-only create", () => {
    expect(writer).toMatch(/noteAuditLog\.create/);
    expect(writer).not.toMatch(/noteAuditLog\.(update|delete|deleteMany|upsert)/);
    expect(liveNoteSources).not.toMatch(/noteAuditLog\.(update|delete|deleteMany|upsert)/);
  });

  it("has zero live NoteEvent writers or readers", () => {
    expect(notes).not.toMatch(/noteEvent\.create/);
    expect(prospectus).not.toMatch(/noteEvent\.create/);
    expect(shoraka).not.toMatch(/noteEvent\.create/);
    expect(mapper).not.toMatch(/note\.events/);
    expect(repository).not.toMatch(/events:/);
    expect(activity).not.toMatch(/noteEvent\.findMany/);
    expect(liveNoteSources).not.toMatch(/prisma\.noteEvent/);
    expect(liveNoteSources).not.toMatch(/tx\.noteEvent/);
  });

  it("keeps NoteEvent and NoteAdminAction models for later cleanup", () => {
    expect(schema).toMatch(/model NoteEvent/);
    expect(schema).toMatch(/model NoteAdminAction/);
    expect(notes).toMatch(/noteAdminAction\.create/);
    expect(prospectus).toMatch(/noteAdminAction\.create/);
  });

  it("does not use NoteAuditLog as workflow or financial state", () => {
    expect(notes).not.toMatch(/noteAuditLog\.find/);
    expect(prospectus).not.toMatch(/noteAuditLog\.find/);
    expect(shoraka).not.toMatch(/noteAuditLog\.find/);
    const closeChunk = methodChunk(notes, "closeFunding", 9000);
    expect(closeChunk).toMatch(/postDisbursementLedger/);
    expect(closeChunk).not.toMatch(/noteAuditLog\.find/);
    const postChunk = methodChunk(notes, "postSettlement", 16000);
    expect(postChunk).toMatch(/postSettlementLedger/);
    expect(postChunk).not.toMatch(/noteAuditLog\.find/);
  });

  it("writes NOTE_CREATED after durable create and skips idempotent existing notes", () => {
    const chunk = methodChunk(notes, "createFromInvoiceSource", 9000);
    expect(chunk).toMatch(/if \(existing\) return mapNoteDetail\(existing\)/);
    expect(chunk).toMatch(/NOTE_CREATED/);
    expect(chunk).toMatch(/sourceType: "INVOICE"/);
    expect(chunk).not.toMatch(/NOTE_CREATED_FROM_INVOICE/);
    expect(chunk).not.toMatch(/events:\s*\{\s*create/);
  });

  it("audits material terms only", () => {
    const chunk = methodChunk(notes, "updateDraft", 3500);
    expect(chunk).toMatch(/NOTE_TERMS_UPDATED/);
    expect(chunk).toMatch(/MATERIAL_TERM_FIELDS/);
    expect(chunk).toMatch(/changedFields/);
  });

  it("publish writes one NOTE_PUBLISHED and unpublish stays truthful", () => {
    const publishChunk = methodChunk(notes, "publish", 9000);
    expect(publishChunk).toMatch(/NOTE_PUBLISHED/);
    expect(publishChunk).not.toMatch(/NOTE_PROSPECTUS_PUBLISHED/);
    const unpublishChunk = methodChunk(notes, "unpublish", 2500);
    expect(unpublishChunk).toMatch(/NOTE_UNPUBLISHED/);
    expect(unpublishChunk).not.toMatch(/INVALIDATED/);
  });

  it("investment commits after cash debit and skips oversubscribe", () => {
    const chunk = methodChunk(notes, "createInvestment", 9000);
    expect(chunk).toMatch(/debitInvestorBalanceForCommit/);
    expect(chunk).toMatch(/INVESTMENT_COMMITTED/);
    expect(chunk).toMatch(/NOTE_OVERSUBSCRIBED/);
  });

  it("default and settlement preview/approve/post audit in the same transaction", () => {
    const defaultChunk = methodChunk(notes, "markDefault", 2500);
    expect(defaultChunk).toMatch(/\$transaction/);
    expect(defaultChunk).toMatch(/NOTE_MARKED_DEFAULT/);
    const previewChunk = methodChunk(notes, "previewSettlement", 7000);
    expect(previewChunk).toMatch(/SETTLEMENT_PREVIEWED/);
    expect(previewChunk).toMatch(/writeNoteAuditFromActor/);
    expect(previewChunk).not.toMatch(/metadata: \{ settlementId: settlement\.id, \.\.\.snapshot \}/);
    const approveChunk = methodChunk(notes, "approveSettlement", 5000);
    expect(approveChunk).toMatch(/SETTLEMENT_APPROVED/);
    const postChunk = methodChunk(notes, "postSettlement", 16000);
    expect(postChunk).toMatch(/SETTLEMENT_POSTED/);
    expect(postChunk).toMatch(/postSettlementLedger/);
  });

  it("does not audit investor withdrawals or late-charge approval", () => {
    const investorChunk = methodChunk(notes, "createInvestorWithdrawal", 2500);
    expect(investorChunk).not.toMatch(/writeNoteAuditFromActor/);
    const lateChunk = methodChunk(notes, "approveLateCharge", 800);
    expect(lateChunk).not.toMatch(/writeNoteAuditFromActor/);
    expect(lateChunk).not.toMatch(/LATE_CHARGE_APPROVED/);
    const overdueChunk = methodChunk(notes, "applyOverdueLateCharge", 2500);
    expect(overdueChunk).toMatch(/NOTE_SERVICING_STATUS_CHANGED/);
    expect(overdueChunk).not.toMatch(/OVERDUE_LATE_CHARGE_CHECKED/);
  });

  it("maps issuer disbursement and residual return events without investor wallet events", () => {
    expect(writer).toMatch(/DISBURSEMENT_INITIATED/);
    expect(writer).toMatch(/RESIDUAL_RETURN_LETTER_GENERATED/);
    expect(writer).not.toMatch(/INVESTOR_WITHDRAWAL/);
    const letterChunk = methodChunk(notes, "generateWithdrawalLetter", 12000);
    expect(letterChunk).toMatch(/noteAuditEventForWithdrawal/);
    expect(letterChunk).toMatch(/fileHash/);
    expect(letterChunk).not.toMatch(/s3Key,/);
    expect(letterChunk).not.toMatch(/s3Key:/);
  });

  it("Shoraka audits durable submit once and certificate after hash", () => {
    const submitChunk = methodChunk(shoraka, "submitOrderForWithdrawal", 15000);
    expect(submitChunk).toMatch(/SHORAKA_ORDER_SUBMITTED/);
    expect(submitChunk).toMatch(/if \(!existing\)/);
    const certChunk = methodChunk(shoraka, "fetchCertificateForWithdrawal", 8000);
    expect(certChunk).toMatch(/certificate_file_sha256/);
    expect(certChunk).toMatch(/SHORAKA_CERTIFICATE_RECEIVED/);
    expect(certChunk).toMatch(/if \(tradeOrder\.certificate_s3_key\)/);
    expect(certChunk).not.toMatch(/callback_payload/);
  });

  it("trustee signature audits only authorisedSignatureImage changes", () => {
    const chunk = methodChunk(notes, "updatePlatformFinanceSettings", 16000);
    expect(chunk).toMatch(/TRUSTEE_SIGNATURE_UPDATED/);
    expect(chunk).toMatch(/signatureChanged/);
    expect(chunk).toMatch(/PLATFORM_SETTING/);
    expect(chunk).not.toMatch(/PLATFORM_FINANCE_SETTINGS_UPDATED/);
  });

  it("admin readers use NoteAuditLog without a hidden 50 cap", () => {
    expect(notes).toMatch(/noteAuditLogReader\.listByNoteId/);
    expect(repository).not.toMatch(/take: 50/);
    expect(activity).toMatch(/noteAuditLog\.findMany/);
    expect(activity).toMatch(/source_table: "note_audit_logs"/);
    expect(activity).toMatch(/NOTE_ACTIVATED/);
    expect(activity).not.toMatch(/WITHDRAWAL_COMPLETED/);
  });

  it("Product/Legal/Notification/Access/Security/Onboarding/Application/Signing audit modules are untouched", () => {
    expect(products).not.toMatch(/writeNoteAuditLog/);
    expect(legal).not.toMatch(/writeNoteAuditLog/);
    expect(access).not.toMatch(/writeNoteAuditLog/);
    expect(security).not.toMatch(/writeNoteAuditLog/);
    expect(onboarding).not.toMatch(/writeNoteAuditLog/);
    expect(notification).not.toMatch(/writeNoteAuditLog/);
    expect(applicationAudit).not.toMatch(/writeNoteAuditLog/);
    expect(signingAudit).not.toMatch(/writeNoteAuditLog/);
    expect(APPLICATION_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
    expect(SIGNING_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
    expect(ONBOARDING_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
    expect(ACCESS_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
    expect(PRODUCT_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
    expect(LEGAL_ADMIN_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
    expect(NOTIFICATION_BROADCAST_AUDIT_EVENTS).not.toContain("NOTE_CREATED");
  });
});
