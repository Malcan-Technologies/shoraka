import fs from "node:fs";
import path from "node:path";
import { PAYMENT_AUDIT_EVENTS } from "./events";
import { PAYMENT_AUDIT_EVENTS as TYPES_PAYMENT_EVENTS } from "@cashsouk/types";
import { NOTE_AUDIT_EVENTS } from "../../notes/audit/events";
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

function collectTsSources(relativeDirs: string[], excludeFileNames: string[] = []): string {
  return relativeDirs
    .flatMap((dir) => {
      const abs = path.join(srcRoot, dir);
      if (!fs.existsSync(abs)) return [];
      return (fs.readdirSync(abs, { recursive: true }) as string[]).map((file) =>
        path.join(abs, file)
      );
    })
    .filter((file) => {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file.endsWith(".spec.ts")) {
        return false;
      }
      return !excludeFileNames.some((name) => file.endsWith(name));
    })
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

function methodChunk(source: string, methodName: string, length = 8000): string {
  const start = [source.indexOf(`async ${methodName}(`), source.indexOf(`async function ${methodName}(`)]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, start + length);
}

const FORBIDDEN_EVENTS = [
  "PAYMENT_REVERSED",
  "PAYEE_NAME_CHECK_REQUESTED",
  "PAYEE_NAME_CHECK_COMPLETED",
  "PAYEE_NAME_CHECK_FAILED",
  "INVESTOR_WITHDRAWAL_CANCELLED",
  "INVESTOR_BALANCE_ADJUSTED",
  "PAYMENT_RECEIPT_GENERATED",
];

describe("Payment audit cutover", () => {
  const writer = readSrc("modules/payment/audit/writer.ts");
  const schema = readSrc("../prisma/schema.prisma");
  const adminService = readSrc("modules/payment/admin-service.ts");
  const orderService = readSrc("modules/payment/gateway-order-service.ts");
  const webhook = readSrc("modules/payment/webhook-service.ts");
  const refund = readSrc("modules/payment/refund-service.ts");
  const deposit = readSrc("modules/payment/deposit-service.ts");
  const amountMismatch = readSrc("modules/payment/amount-mismatch-service.ts");
  const reconService = readSrc("modules/payment/recon-service.ts");
  const reconJob = readSrc("lib/jobs/gateway-settlement-recon.ts");
  const poller = readSrc("lib/jobs/gateway-stuck-order-poller.ts");
  const notes = readSrc("modules/notes/service.ts");
  const receipt = readSrc("modules/payment/receipt/receipt-service.ts");
  const typesGateway = readSrc("../../../packages/types/src/gateway-payments.ts");
  const livePaymentSources = collectTsSources(["modules/payment", "lib/jobs", "modules/notes"]);
  const products = collectTsSources(["modules/products"]);
  const legal = collectTsSources(["modules/legal-documents"]);
  const access = collectTsSources(["modules/auth"]);
  const security = collectTsSources(["modules/security"]);
  const onboarding = collectTsSources(["modules/onboarding"]);
  const notification = collectTsSources(["modules/notification"]);
  const applicationAudit = collectTsSources(["modules/applications/audit"]);
  const signingAudit = collectTsSources(["modules/signing/audit"]);
  const noteAudit = collectTsSources(["modules/notes/audit"]);

  it("event catalogues match between API and types", () => {
    expect([...TYPES_PAYMENT_EVENTS]).toEqual([...PAYMENT_AUDIT_EVENTS]);
  });

  it("implements the approved catalogue and not dropped events", () => {
    expect(PAYMENT_AUDIT_EVENTS).toHaveLength(19);
    for (const event of FORBIDDEN_EVENTS) {
      expect(PAYMENT_AUDIT_EVENTS).not.toContain(event);
      expect(livePaymentSources).not.toMatch(new RegExp(`eventType:\\s*"${event}"`));
    }
    expect(livePaymentSources).not.toMatch(/eventType:\s*"PAYEE_/);
    expect(livePaymentSources).not.toMatch(/eventType:\s*"payment\./);
    expect(livePaymentSources).not.toMatch(/eventType:\s*"order\./);
    expect(livePaymentSources).not.toMatch(/eventType:\s*"refund\./);
    expect(livePaymentSources).not.toMatch(/eventType:\s*"ONBOARDING_/);
    expect(livePaymentSources).not.toMatch(/eventType:\s*"APPLICATION_/);
    expect(livePaymentSources).not.toMatch(/eventType:\s*"NOTE_INVESTMENT/);
  });

  it("PaymentAuditLog model has no FKs, no updated_at, required metadata", () => {
    const start = schema.indexOf("model PaymentAuditLog");
    const end = schema.indexOf("model ", start + "model PaymentAuditLog".length);
    const model = schema.slice(start, end > start ? end : undefined);
    expect(model).toMatch(/metadata\s+Json/);
    expect(model).not.toMatch(/@relation/);
    expect(model).not.toMatch(/updated_at/);
    expect(model).not.toMatch(/device_info/);
    expect(model).toMatch(/gateway_payment_id\s+String\?/);
    expect(model).toMatch(/idempotency_key\s+String\?\s+@unique/);
    expect(model).toMatch(/@@index\(\[gateway_payment_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[event_type, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[organization_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[actor_user_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[target_type, target_id, occurred_at\]\)/);
    expect(model).toMatch(/@@index\(\[correlation_id\]\)/);
  });

  it("writer is append-only create", () => {
    expect(writer).toMatch(/paymentAuditLog\.create/);
    expect(writer).toMatch(/paymentAuditLog\.findUnique/);
    expect(writer).not.toMatch(/paymentAuditLog\.(update|delete|deleteMany|upsert)/);
    expect(livePaymentSources).not.toMatch(/paymentAuditLog\.(update|delete|deleteMany|upsert)/);
  });

  it("has no leftover GatewayPaymentEvent model, helper, or DTO", () => {
    expect(schema).not.toMatch(/model GatewayPaymentEvent/);
    expect(schema).not.toMatch(/enum GatewayPaymentEventType/);
    expect(schema).not.toMatch(/events\s+GatewayPaymentEvent\[\]/);
    expect(fs.existsSync(path.join(srcRoot, "modules/payment/gateway-events.ts"))).toBe(false);
    expect(livePaymentSources).not.toMatch(/gatewayPaymentEvent\./);
    expect(livePaymentSources).not.toMatch(/recordGatewayPaymentEvent/);
    expect(livePaymentSources).not.toMatch(/mapGatewayPaymentEvent/);
    expect(livePaymentSources).not.toMatch(/getOpenOverrideProposal/);
    expect(livePaymentSources).not.toMatch(/OVERRIDE_PROPOSED/);
    expect(livePaymentSources).not.toMatch(/OVERRIDE_APPROVED/);
    expect(livePaymentSources).not.toMatch(/OVERRIDE_REJECTED/);
    expect(adminService).toMatch(/paymentAuditLogReader\.listByGatewayPaymentId/);
    expect(adminService).not.toMatch(/events:\s*\{\s*orderBy/);
    expect(adminService).not.toMatch(/include:[\s\S]{0,80}events:/);
    expect(typesGateway).toMatch(/events: PaymentAuditLogDto\[\]/);
    expect(typesGateway).not.toMatch(/GatewayPaymentEventDto/);
    expect(typesGateway).not.toMatch(/GatewayPaymentEventType/);
  });

  it("does not use PaymentAuditLog as payment, balance, withdrawal, recon, or receipt SOT", () => {
    expect(adminService).not.toMatch(/paymentAuditLog\.findFirst/);
    expect(adminService).toMatch(/status !== GatewayPaymentStatus/);
    expect(deposit).toMatch(/creditInvestorBalance/);
    expect(deposit).toMatch(/INVESTOR_DEPOSIT_RECEIVED/);
    expect(reconService).toMatch(/gatewayReconException/);
    expect(receipt).not.toMatch(/writeGatewayPaymentAudit/);
    expect(receipt).not.toMatch(/PAYMENT_RECEIPT_GENERATED/);
  });

  it("initiates only after a durable GatewayPayment CREATED row", () => {
    const chunk = methodChunk(orderService, "createGatewayOrder", 12000);
    expect(chunk).toMatch(/gatewayPayment\.create/);
    expect(chunk).toMatch(/PAYMENT_INITIATED/);
    expect(chunk.indexOf("gatewayPayment.create")).toBeLessThan(chunk.indexOf("PAYMENT_INITIATED"));
    expect(chunk).toMatch(/GATEWAY_ORDER_PERSIST_FAILED/);
    const persistFailedIndex = chunk.indexOf("GATEWAY_ORDER_PERSIST_FAILED");
    const initiatedIndex = chunk.indexOf("PAYMENT_INITIATED");
    expect(initiatedIndex).toBeGreaterThan(persistFailedIndex);
    expect(chunk).toMatch(/return mapGatewayPaymentResponse\(existingPayment\)/);
    expect(chunk.slice(chunk.indexOf("existingPayment"), chunk.indexOf("existingPayment") + 400)).not.toMatch(
      /PAYMENT_INITIATED/
    );
  });

  it("captures the first CREATED or EXPIRED to PAID transition once", () => {
    const chunk = methodChunk(webhook, "claimCaptureToPaid", 2500);
    expect(chunk).toMatch(/CREATED/);
    expect(chunk).toMatch(/EXPIRED/);
    expect(chunk).toMatch(/writePaymentCapturedAudit/);
    expect(webhook).toMatch(/PAYMENT_AUDIT_IDEMPOTENCY\.captured/);
    expect(amountMismatch).toMatch(/PAYMENT_CAPTURED/);
    expect(amountMismatch).toMatch(/PAYMENT_CAPTURE_MISMATCH_DETECTED/);
  });

  it("fails and expires only on durable local status changes", () => {
    const failed = methodChunk(webhook, "markGatewayPaymentFailedByOrderId", 2500);
    expect(failed).toMatch(/CREATED/);
    expect(failed).toMatch(/PAYMENT_FAILED/);
    expect(failed).toMatch(/\$transaction/);
    const sync = methodChunk(webhook, "syncGatewayPaymentFromCurlec", 3500);
    expect(sync).toMatch(/Curlec order payments sync failed/);
    expect(sync).toMatch(/return payment/);
    expect(poller).toMatch(/PAYMENT_EXPIRED/);
    expect(poller).toMatch(/current.status !== GatewayPaymentStatus.CREATED/);
  });

  it("maps refunds truthfully and never writes PAYMENT_REVERSED", () => {
    expect(refund).toMatch(/PAYMENT_REFUND_INITIATED/);
    expect(refund).toMatch(/PAYMENT_REFUNDED/);
    expect(refund).toMatch(/PAYMENT_REFUND_WALLET_REVERSAL_FAILED/);
    expect(refund).not.toMatch(/PAYMENT_REVERSED/);
    expect(refund).toMatch(/return GatewayPaymentStatus.HELD/);
  });

  it("uses deposit name-check events and truthful reject ordering", () => {
    expect(deposit).toMatch(/PAYMENT_NAME_CHECK_PENDING/);
    expect(deposit).not.toMatch(/PAYEE_/);
    const approve = methodChunk(adminService, "approveNameCheck", 2500);
    expect(approve).toMatch(/PAYMENT_NAME_CHECK_APPROVED/);
    expect(approve).toMatch(/creditCompletedDeposit/);
    const reject = methodChunk(adminService, "rejectNameCheck", 2500);
    expect(reject).toMatch(/PAYMENT_NAME_CHECK_REJECTED/);
    expect(reject).toMatch(/newStatus: GatewayPaymentStatus.NAME_CHECK_PENDING/);
    expect(reject.indexOf("PAYMENT_NAME_CHECK_REJECTED")).toBeLessThan(
      reject.indexOf("initiateInvestorDepositRefund")
    );
  });

  it("audits investor withdrawals only and keeps issuer types on NoteAuditLog", () => {
    const requestedFull = methodChunk(notes, "createInvestorWithdrawal", 12000);
    const requested = requestedFull.split("\n  async generateWithdrawalLetter")[0];
    expect(requested).toMatch(/debitInvestorBalanceForWithdrawal/);
    expect(requested).toMatch(/writeInvestorWithdrawalAudit/);
    expect(requested).toMatch(/INVESTOR_WITHDRAWAL_REQUESTED/);
    expect(requested).toMatch(/withdrawalIntentId/);
    expect(requested).toMatch(/FOR UPDATE/);
    expect(requested.indexOf("createWithdrawalInstructionWithDisplayReference")).toBeGreaterThan(-1);
    expect(requested.indexOf("createWithdrawalInstructionWithDisplayReference")).toBeLessThan(
      requested.indexOf("debitInvestorBalanceForWithdrawal")
    );
    expect(requested).not.toMatch(/randomUUID/);
    expect(requested).not.toMatch(/writeNoteAuditFromActor/);
    const letter = methodChunk(notes, "generateWithdrawalLetter", 14000);
    expect(letter).toMatch(/noteAuditEventForWithdrawal/);
    expect(letter).toMatch(/INVESTOR_WITHDRAWAL_LETTER_GENERATED/);
    const beneficiary = methodChunk(notes, "updateWithdrawalBeneficiary", 5000);
    expect(beneficiary).toMatch(/beneficiaryChangedFields/);
    expect(beneficiary).toMatch(/INVESTOR_WITHDRAWAL_BENEFICIARY_UPDATED/);
    expect(beneficiary).toMatch(/changedFields/);
    expect(notes).toMatch(/INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE/);
    expect(notes).toMatch(/INVESTOR_WITHDRAWAL_COMPLETED/);
    expect(notes).not.toMatch(/INVESTOR_WITHDRAWAL_CANCELLED/);
    expect(noteAudit).not.toMatch(/INVESTOR_WITHDRAWAL_REQUESTED/);
  });

  it("detects recon exceptions with logical idempotency and ignores successful matches", () => {
    expect(reconJob).toMatch(/PAYMENT_RECONCILIATION_EXCEPTION_DETECTED/);
    expect(reconJob).toMatch(/reconDetected/);
    expect(reconJob).toMatch(/gatewayReconException\.deleteMany/);
    expect(reconJob).not.toMatch(/PAYMENT_CAPTURE_MISMATCH_DETECTED/);
    expect(reconService).toMatch(/PAYMENT_RECONCILIATION_EXCEPTION_RESOLVED/);
    expect(reconService).toMatch(/reconResolved/);
  });

  it("Product/Legal/Notification/Access/Security/Onboarding/Application/Signing/Note audit modules are untouched", () => {
    expect(products).not.toMatch(/writePaymentAuditLog/);
    expect(legal).not.toMatch(/writePaymentAuditLog/);
    expect(access).not.toMatch(/writePaymentAuditLog/);
    expect(security).not.toMatch(/writePaymentAuditLog/);
    expect(onboarding).not.toMatch(/writePaymentAuditLog/);
    expect(notification).not.toMatch(/writePaymentAuditLog/);
    expect(applicationAudit).not.toMatch(/writePaymentAuditLog/);
    expect(signingAudit).not.toMatch(/writePaymentAuditLog/);
    expect(noteAudit).not.toMatch(/writePaymentAuditLog/);
    expect(APPLICATION_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(SIGNING_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(ONBOARDING_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(ACCESS_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(SECURITY_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(PRODUCT_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(LEGAL_ADMIN_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(NOTIFICATION_BROADCAST_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(NOTE_AUDIT_EVENTS).not.toContain("PAYMENT_INITIATED");
    expect(NOTE_AUDIT_EVENTS).not.toContain("INVESTOR_WITHDRAWAL_REQUESTED");
  });
});
