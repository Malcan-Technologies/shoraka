jest.mock("../../../lib/prisma", () => ({
  prisma: {},
}));

jest.mock("../../../lib/audit/snapshot", () => ({
  loadAuditActorSnapshot: jest.fn(),
}));

import { noteAuditEventForWithdrawal } from "./writer";

describe("noteAuditEventForWithdrawal", () => {
  it("maps issuer disbursement operations", () => {
    expect(noteAuditEventForWithdrawal("ISSUER_DISBURSEMENT", "initiated")).toBe(
      "DISBURSEMENT_INITIATED"
    );
    expect(noteAuditEventForWithdrawal("ISSUER_DISBURSEMENT", "letter")).toBe(
      "DISBURSEMENT_LETTER_GENERATED"
    );
    expect(noteAuditEventForWithdrawal("ISSUER_DISBURSEMENT", "submitted")).toBe(
      "DISBURSEMENT_SUBMITTED_TO_TRUSTEE"
    );
    expect(noteAuditEventForWithdrawal("ISSUER_DISBURSEMENT", "beneficiary")).toBe(
      "DISBURSEMENT_BENEFICIARY_UPDATED"
    );
    expect(noteAuditEventForWithdrawal("ISSUER_DISBURSEMENT", "completed")).toBe(
      "DISBURSEMENT_COMPLETED"
    );
  });

  it("maps residual return operations that exist and drops the rest", () => {
    expect(noteAuditEventForWithdrawal("ISSUER_RESIDUAL_RETURN", "letter")).toBe(
      "RESIDUAL_RETURN_LETTER_GENERATED"
    );
    expect(noteAuditEventForWithdrawal("ISSUER_RESIDUAL_RETURN", "submitted")).toBe(
      "RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE"
    );
    expect(noteAuditEventForWithdrawal("ISSUER_RESIDUAL_RETURN", "completed")).toBe(
      "RESIDUAL_RETURN_COMPLETED"
    );
    expect(noteAuditEventForWithdrawal("ISSUER_RESIDUAL_RETURN", "initiated")).toBeNull();
    expect(noteAuditEventForWithdrawal("ISSUER_RESIDUAL_RETURN", "beneficiary")).toBeNull();
  });

  it("does not map investor-wallet withdrawals into NoteAuditLog", () => {
    expect(noteAuditEventForWithdrawal("INVESTOR_WITHDRAWAL", "initiated")).toBeNull();
    expect(noteAuditEventForWithdrawal("INVESTOR_WITHDRAWAL", "letter")).toBeNull();
    expect(noteAuditEventForWithdrawal("INVESTOR_WITHDRAWAL", "submitted")).toBeNull();
    expect(noteAuditEventForWithdrawal("INVESTOR_WITHDRAWAL", "beneficiary")).toBeNull();
    expect(noteAuditEventForWithdrawal("INVESTOR_WITHDRAWAL", "completed")).toBeNull();
  });
});
