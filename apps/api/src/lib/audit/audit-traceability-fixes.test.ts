import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveApplicationLogTarget } from "../../modules/applications/logs/audit-fields";
import { resolveNoteEventTarget } from "../../modules/notes/audit-fields";
import { AUDIT_TARGET_TYPE } from "./context";

const API_SRC = join(__dirname, "..", "..");

function read(relative: string) {
  return readFileSync(join(API_SRC, relative), "utf8");
}

describe("audit traceability source contracts", () => {
  it("ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED stores withdrawalId and withdrawalReference", () => {
    const src = read("modules/notes/service.ts");
    const idx = src.indexOf("ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED");
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 500);
    expect(window).toMatch(/withdrawalId:/);
    expect(window).toMatch(/withdrawalReference/);
    expect(window).not.toMatch(/note_id:/);
  });

  it("CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED targets the contract and stores previous/next values", () => {
    const src = read("modules/admin/service.ts");
    const idx = src.indexOf("CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED");
    const window = src.slice(idx - 400, idx + 700);
    expect(window).toMatch(/entityId: contractId/);
    expect(window).toMatch(/contract_id: contractId/);
    expect(window).toMatch(/previousValues/);
    expect(window).toMatch(/nextValues/);
    expect(window).toMatch(/is_large_private_company/);
    const target = resolveApplicationLogTarget("CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED", {
      applicationId: "app-1",
      entityId: "contract-1",
      metadata: { contract_id: "contract-1" },
    });
    expect(target).toEqual({ targetType: AUDIT_TARGET_TYPE.CONTRACT, targetId: "contract-1" });
  });

  it("withdrawal create target is the withdrawal instruction id", () => {
    const target = resolveNoteEventTarget("ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED", {
      withdrawalId: "wdl-1",
      withdrawalReference: "WDL-ARF-202608-A1Z",
    });
    expect(target).toEqual({ targetType: AUDIT_TARGET_TYPE.WITHDRAWAL, targetId: "wdl-1" });
  });

  it("NOTE_CREATED_FROM_INVOICE uses the standard note event writer", () => {
    const src = read("modules/notes/service.ts");
    expect(src).toMatch(/logEvent\([\s\S]*NOTE_CREATED_FROM_INVOICE/);
    expect(src).not.toMatch(/event_type:\s*"NOTE_CREATED_FROM_INVOICE"/);
  });

  it("PATCH /status no longer logs a second APPLICATION_RESUBMITTED", () => {
    const src = read("modules/applications/controller.ts");
    expect(src).toMatch(/if \(status === "SUBMITTED"\)/);
    expect(src).not.toMatch(/status === "SUBMITTED" \|\| status === "RESUBMITTED"/);
  });

  it("does not write WEBHOOK_APPROVED when the organisation approval path already logs ONBOARDING_APPROVED", () => {
    const src = read("modules/regtank/service.ts");
    expect(src).toMatch(/skipWebhookTransportLog = Boolean\(organizationId\)/);
    expect(src).toMatch(/eventType: "ONBOARDING_APPROVED"/);
  });

  it("OVERRIDE_* gateway events still have no live writer", () => {
    const src = [
      read("modules/payment/gateway-events.ts"),
      read("modules/payment/admin-service.ts"),
      read("modules/payment/webhook-service.ts"),
      read("modules/admin/service.ts"),
    ].join("\n");
    expect(src).not.toMatch(/type:\s*GatewayPaymentEventType\.OVERRIDE_PROPOSED/);
    expect(src).not.toMatch(/type:\s*"OVERRIDE_PROPOSED"/);
    expect(src).not.toMatch(/eventType:\s*"OVERRIDE_PROPOSED"/);
    expect(src).not.toMatch(/eventType:\s*"OVERRIDE_APPROVED"/);
    expect(src).not.toMatch(/eventType:\s*"OVERRIDE_REJECTED"/);
  });

  it("admin and self-service PROFILE_UPDATED writers store nextValues", () => {
    expect(read("modules/admin/service.ts")).toMatch(/nextValues/);
    expect(read("modules/auth/service.ts")).toMatch(/nextValues:\s*\{[\s\S]*firstName: updatedUser.first_name/);
    expect(read("modules/organization/service.ts")).toMatch(/eventType: "PROFILE_UPDATED"/);
    expect(read("modules/organization/service.ts")).toMatch(/MEMBER_ADDED/);
    expect(read("modules/organization/service.ts")).toMatch(/MEMBER_INVITED/);
    expect(read("modules/organization/service.ts")).toMatch(/MEMBER_REMOVED/);
    expect(read("modules/organization/service.ts")).toMatch(/MEMBER_ROLE_CHANGED/);
  });

  it("MARC_ASSESSMENT_SAVED writes organisation previous/next evidence in the same transaction", () => {
    const src = read("modules/paymaster/service.ts");
    expect(src).toMatch(/MARC_ASSESSMENT_SAVED/);
    expect(src).toMatch(/createOnboardingLogRow/);
    expect(src).toMatch(/\$transaction/);
    expect(read("modules/paymaster/marc-assessment-audit.ts")).toMatch(/nextValues/);
    expect(read("modules/paymaster/marc-assessment-audit.ts")).toMatch(/previousValues/);
    expect(read("modules/paymaster/controller.ts")).toMatch(/auditContextFromRequest\(req, \{ res \}\)/);
  });

  it("signing SENT/COMPLETED snapshot a provider reference when available", () => {
    const src = read("modules/signing/service.ts");
    expect(src).toMatch(/providerEnvelopeId/);
    expect(src).toMatch(/providerContractRefs/);
  });

  it("WITHDRAWAL_BENEFICIARY_UPDATED stores previous and next beneficiary snapshots", () => {
    const src = read("modules/notes/service.ts");
    const idx = src.indexOf("WITHDRAWAL_BENEFICIARY_UPDATED");
    const window = src.slice(idx, idx + 450);
    expect(window).toMatch(/previousValues/);
    expect(window).toMatch(/nextValues/);
    expect(window).toMatch(/withdrawalReference/);
  });

  it("APPLICATION_RESET_TO_UNDER_REVIEW stores previous and new status", () => {
    const src = read("modules/admin/service.ts");
    const idx = src.indexOf("APPLICATION_RESET_TO_UNDER_REVIEW");
    const window = src.slice(idx, idx + 250);
    expect(window).toMatch(/previous_status/);
    expect(window).toMatch(/new_status: "UNDER_REVIEW"/);
  });

  it("facility enabled/disabled stores explicit previous and next enabled flags", () => {
    const src = read("modules/admin/service.ts");
    expect(src).toMatch(/CONTRACT_FACILITY_ENABLED/);
    const idx = src.indexOf("previousValues: { enabled: updated.previouslyEnabled }");
    expect(idx).toBeGreaterThan(-1);
  });

  it("admin security PROFILE_UPDATED includes phone previous/next and phone-only edits", () => {
    const src = read("modules/admin/service.ts");
    const idx = src.indexOf("Security trail for any admin profile patch");
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 900);
    expect(window).toMatch(/hasCompletedOnboarding && updatedFields.length > 0/);
    expect(window).toMatch(/phone: user.phone/);
    expect(window).toMatch(/nextValues/);
    expect(window).toMatch(/adminOverride: true/);
  });

  it("access PROFILE_UPDATED stores previous and next identity values", () => {
    const src = read("modules/admin/service.ts");
    const nextIdx = src.indexOf("const nextValues = {\n      firstName: updatedUser.first_name");
    expect(nextIdx).toBeGreaterThan(-1);
    const idx = src.indexOf('eventType: "PROFILE_UPDATED"');
    const window = src.slice(idx, idx + 700);
    expect(window).toMatch(/previousValues:/);
    expect(window).toMatch(/nextValues/);
  });

  it("issuer HTTP actions pass available log context into writers", () => {
    const applicationsController = read("modules/applications/controller.ts");
    expect(applicationsController).toMatch(/issuerActivityFromRequest\(req, res\)/);
    expect(applicationsController).toMatch(
      /updateApplicationStatus\(\s*id,\s*status,\s*userId,\s*issuerActivityFromRequest/
    );
    expect(read("modules/invoices/controller.ts")).toMatch(/issuerActivityFromRequest\(req, res\)/);
    expect(read("modules/contracts/controller.ts")).toMatch(/issuerActivityFromRequest\(req, res\)/);
    expect(read("modules/applications/amendments/service.ts")).toMatch(/\.\.\.logContext/);
  });

  it("trustee email events store id plus display reference when available", () => {
    const src = read("modules/notes/service.ts");
    const withdrawal = src.slice(
      src.indexOf("WITHDRAWAL_TRUSTEE_EMAIL_SENT"),
      src.indexOf("WITHDRAWAL_TRUSTEE_EMAIL_SENT") + 220
    );
    expect(withdrawal).toMatch(/withdrawalId/);
    expect(withdrawal).toMatch(/withdrawalReference/);
    const settlement = src.slice(
      src.indexOf("SETTLEMENT_TRUSTEE_EMAIL_SENT"),
      src.indexOf("SETTLEMENT_TRUSTEE_EMAIL_SENT") + 220
    );
    expect(settlement).toMatch(/settlementId/);
    expect(settlement).toMatch(/settlementReference/);
  });

  it("handleWebhookUpdate uses webhook audit context and skips WEBHOOK_APPROVED when ONBOARDING_APPROVED already ran", () => {
    const src = read("modules/regtank/service.ts");
    expect(src).toMatch(/context: webhookAuditContext\(\)/);
    expect(src).toMatch(/skipWebhookTransportLog = Boolean\(organizationId\)/);
    expect(src).not.toMatch(/eventType = "WEBHOOK_PENDING_APPROVAL"/);
    expect(src).not.toMatch(/eventType = "WEBHOOK_IN_PROGRESS"/);
  });

  it("NOTE_CREATED_FROM_INVOICE target falls back to the note id", () => {
    const target = resolveNoteEventTarget("NOTE_CREATED_FROM_INVOICE", {
      applicationId: "app-1",
      invoiceId: "inv-1",
    });
    expect(target.targetType).toBe(AUDIT_TARGET_TYPE.NOTE);
    expect(read("modules/notes/service.ts")).toMatch(/targetId: target.targetId \?\? noteId/);
  });

  it("does not activate OVERRIDE_* writers", () => {
    const notes = read("modules/notes/service.ts");
    expect(notes).not.toMatch(/OVERRIDE_PROPOSED/);
    expect(notes).not.toMatch(/OVERRIDE_APPROVED/);
    expect(notes).not.toMatch(/OVERRIDE_REJECTED/);
  });

  it("facility-fee waive writes one note_events row with reason and before/after", () => {
    const src = read("modules/notes/service.ts");
    const method = src.slice(
      src.indexOf("async waiveFacilityFeeCollection"),
      src.indexOf("async closeFunding")
    );
    expect(method).toMatch(/WAIVE_FACILITY_FEE_COLLECTION/);
    expect(method).toMatch(/reason: reason\.trim\(\)/);
    expect(method).not.toMatch(/NOTE_FACILITY_FEE_COLLECTION_WAIVED/);
    const logAdmin = src.slice(
      src.indexOf("private async logAdminAction"),
      src.indexOf("private async getLedgerAccountId")
    );
    expect(logAdmin).toMatch(/extraMetadata/);
    expect(logAdmin).toMatch(/beforeState/);
    expect(logAdmin).toMatch(/afterState/);
    expect(logAdmin.match(/this\.logEvent\(/g)?.length).toBe(1);
  });

  it("WITHDRAWAL_LETTER_GENERATED stores withdrawalId and withdrawalReference without note_id", () => {
    const src = read("modules/notes/service.ts");
    const idx = src.indexOf("WITHDRAWAL_LETTER_GENERATED");
    const window = src.slice(idx, idx + 350);
    expect(window).toMatch(/withdrawalId: id/);
    expect(window).toMatch(/withdrawalReference/);
    expect(window).toMatch(/s3Key: key/);
    expect(window).not.toMatch(/note_id:/);
  });

  it("Shoraka target_id is the CashSouk trade-order id, not the provider order id", () => {
    const submitted = resolveNoteEventTarget("SHORAKA_ORDER_SUBMITTED", {
      trade_order_id: "trade-order-cuid",
      provider_order_id: "provider-order-abc",
    });
    expect(submitted).toEqual({
      targetType: AUDIT_TARGET_TYPE.SHORAKA_ORDER,
      targetId: "trade-order-cuid",
    });
    const fetched = resolveNoteEventTarget("SHORAKA_CERTIFICATE_FETCHED", {
      trade_order_id: "trade-order-cuid",
      provider_order_id: "provider-order-abc",
    });
    expect(fetched.targetId).toBe("trade-order-cuid");
    expect(fetched.targetId).not.toBe("provider-order-abc");
  });

  it("occupancy writers snapshot display refs from already-loaded rows", () => {
    const src = read("lib/refresh-contract-facility.ts");
    expect(src).toMatch(/occupancyDisplayRefsFromLoaded/);
    expect(src).toMatch(/contractReference: input\.displayRefs\?\.contractReference/);
    expect(src).toMatch(/originating_application: \{ select: \{ id: true, display_reference: true \} \}/);
  });
});
