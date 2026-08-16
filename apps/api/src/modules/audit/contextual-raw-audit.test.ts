import { readFileSync } from "node:fs";
import { join } from "node:path";

const srcRoot = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

function methodChunk(source: string, methodName: string, length = 2500): string {
  const start = [source.indexOf(`async ${methodName}(`), source.indexOf(`async function ${methodName}(`)]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  expect(start).toBeGreaterThan(-1);
  const afterOpen = source.indexOf("{", start);
  const nextAsync = source.indexOf("\n  async ", afterOpen + 1);
  const end = nextAsync === -1 ? start + length : Math.min(nextAsync, start + length);
  return source.slice(start, end);
}

describe("contextual raw audit readers and endpoints", () => {
  const applicationReader = readSrc("modules/applications/audit/reader.ts");
  const applicationService = readSrc("modules/applications/service.ts");
  const noteReader = readSrc("modules/notes/audit/reader.ts");
  const noteService = readSrc("modules/notes/service.ts");
  const noteController = readSrc("modules/notes/controller.ts");
  const paymentReader = readSrc("modules/payment/audit/reader.ts");
  const reconService = readSrc("modules/payment/recon-service.ts");
  const reconController = readSrc("modules/payment/recon-controller.ts");

  it("merges Application + Signing history without dropping envelope or application ids", () => {
    expect(applicationReader).toContain("applicationId: row.application_id");
    expect(applicationReader).toContain("signingEnvelopeId: log.signingEnvelopeId");
    expect(applicationReader).toContain("applicationId: log.applicationId");
    expect(applicationService).toContain("mergeApplicationAndSigningAuditLogs");
    expect(methodChunk(applicationService, "getApplicationLogs")).not.toMatch(
      /event_type:\s*\{\s*in:/
    );
  });

  it("lists note history by note_id and trustee history by event_type, not note_id", () => {
    const noteHistory = methodChunk(noteReader, "listByNoteId");
    expect(noteHistory).toContain("note_id: noteId");
    expect(noteHistory).not.toContain("TRUSTEE_SIGNATURE_UPDATED");

    const trustee = methodChunk(noteReader, "listTrusteeSignatureUpdates");
    expect(trustee).toContain('event_type: "TRUSTEE_SIGNATURE_UPDATED"');
    expect(trustee).toContain('target_type: "PLATFORM_SETTING"');
    expect(trustee).not.toContain("note_id:");

    expect(methodChunk(noteService, "listEvents")).toContain("listByNoteId");
    expect(methodChunk(noteService, "listTrusteeSignatureAudit")).toContain(
      "listTrusteeSignatureUpdates"
    );
    expect(noteController).toContain('"/trustee-signature/audit"');
    expect(noteController).toContain('requirePermission("platform_settings.view")');
  });

  it("looks up withdrawal and recon payment audit by target_type and target_id", () => {
    const listByTarget = methodChunk(paymentReader, "listByTarget");
    expect(listByTarget).toContain("target_type: targetType");
    expect(listByTarget).toContain("target_id: targetId");

    const withdrawalEvents = methodChunk(noteService, "listInvestorWithdrawalEvents");
    expect(withdrawalEvents).toContain("getInvestorWithdrawal");
    expect(withdrawalEvents).toContain("PAYMENT_AUDIT_TARGET_TYPE.WITHDRAWAL");
    expect(withdrawalEvents).toContain("listByTarget");

    expect(noteController).toContain('"/:id/events"');
    expect(noteController).toContain('requirePermission("investor_withdrawals.view")');

    const reconEvents = methodChunk(reconService, "listReconExceptionEvents");
    expect(reconEvents).toContain("RECON_EXCEPTION_NOT_FOUND");
    expect(reconEvents).toContain("PAYMENT_AUDIT_TARGET_TYPE.RECON_EXCEPTION");
    expect(reconEvents).toContain("listByTarget");

    expect(reconController).toContain('"/exceptions/:id/events"');
    expect(reconController).toContain('requirePermission("gateway_reconciliation.view")');
  });

  it("does not mix withdrawal or recon lookup into gateway payment detail", () => {
    const adminService = readSrc("modules/payment/admin-service.ts");
    expect(adminService).toContain("listByGatewayPaymentId");
    expect(adminService).not.toContain("listByTarget");
  });
});

describe("activity adapters and issuer application logs remain unchanged", () => {
  it("does not add visibility filters or new writers to Activity adapters", () => {
    const applicationAdapter = readSrc("modules/activity/adapters/application-log.ts");
    const noteAdapter = readSrc("modules/activity/adapters/note-log.ts");
    const signingAdapter = readSrc("modules/activity/adapters/signing-log.ts");

    expect(applicationAdapter).toContain("export class ApplicationLogAdapter");
    expect(noteAdapter).toContain("export class NoteLogAdapter");
    expect(signingAdapter).toContain("export class SigningLogAdapter");

    for (const source of [applicationAdapter, noteAdapter, signingAdapter]) {
      expect(source).not.toContain("listTrusteeSignatureUpdates");
      expect(source).not.toContain("listByTarget");
      expect(source).not.toContain("getApplicationAuditHistory");
      expect(source).not.toContain("HIDE");
    }
  });

  it("keeps issuer application logs on the shared endpoint with the existing normalizer", () => {
    const issuerHook = readFileSync(
      join(srcRoot, "../../../apps/issuer/src/hooks/use-application-logs.ts"),
      "utf8"
    );
    expect(issuerHook).toContain("getApplicationLogs");
    expect(issuerHook).toContain("normalizeLogItem");
    expect(issuerHook).toContain("event_type");
    expect(issuerHook).not.toContain("getApplicationAuditHistory");
    expect(issuerHook).not.toContain("signingEnvelopeId");
  });
});
