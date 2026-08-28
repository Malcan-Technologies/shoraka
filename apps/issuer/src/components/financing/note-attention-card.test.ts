jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

jest.mock("@cashsouk/ui", () => ({
  isNoteFullySettled: () => false,
}));

import type { NoteListItem } from "@cashsouk/types";
import { getNoteAttentionAction } from "./note-attention-card-model";

function note(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    title: "Acme invoice note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: null,
    sourceApplicationId: "app_1",
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org_1",
    issuerOrganizationDisplayReference: null,
    issuerName: null,
    paymasterName: "Acme",
    riskRating: null,
    status: "ACTIVE" as NoteListItem["status"],
    listingStatus: "PUBLISHED" as NoteListItem["listingStatus"],
    fundingStatus: "FUNDED" as NoteListItem["fundingStatus"],
    servicingStatus: "CURRENT" as NoteListItem["servicingStatus"],
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 0,
    maturityDate: "2026-01-01",
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: null,
    fundingClosedAt: null,
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    requestedAmount: 8000,
    invoiceAmount: 10000,
    settlementAmount: 8000,
    targetAmount: 8000,
    fundedAmount: 8000,
    fundingPercent: 100,
    minimumFundingPercent: 80,
    profitRatePercent: 8,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    ...overrides,
  };
}

describe("getNoteAttentionAction", () => {
  it("asks the issuer to pay separately billed late charges first", () => {
    const action = getNoteAttentionAction(
      note({
        excessLateCharges: {
          owed: 250,
          paid: 0,
          outstanding: 250,
          noteReference: "NOTE-1",
        },
      })
    );
    expect(action.headline).toBe("Pay outstanding late charges");
    expect(action.label).toBe("Pay late charges");
    expect(action.hint).toContain("NOTE-1");
    expect(action.hint).not.toContain("note_1");
  });

  it("does not fall back to the full note id when the reference is missing", () => {
    const action = getNoteAttentionAction(
      note({
        noteReference: "",
        excessLateCharges: {
          owed: 250,
          paid: 0,
          outstanding: 250,
          noteReference: "",
        },
      })
    );
    expect(action.hint).not.toContain("note_1");
    expect(action.hint).toMatch(/#[A-Z0-9]+/);
  });

  it("asks for repayment proof when the note is in arrears", () => {
    const action = getNoteAttentionAction(
      note({
        status: "ARREARS" as NoteListItem["status"],
        servicingStatus: "ARREARS" as NoteListItem["servicingStatus"],
      })
    );
    expect(action.headline).toBe("Repayment is in arrears");
    expect(action.label).toBe("Report repayment");
  });

  it("names overdue repayment without a formal arrears status", () => {
    const action = getNoteAttentionAction(note());
    expect(action.headline).toBe("Repayment is overdue");
    expect(action.label).toBe("View details");
  });
});
