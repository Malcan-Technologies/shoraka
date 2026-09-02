import {
  isPaymasterFacilityRow,
  isPaymasterNoteRow,
  paymasterFinancingHref,
  paymasterFinancingKind,
  paymasterFinancingTitle,
} from "./paymaster-linked-records";
import type { PaymasterFinancingRow } from "@cashsouk/types";

function row(overrides: Partial<PaymasterFinancingRow> = {}): PaymasterFinancingRow {
  return {
    applicationId: null,
    applicationDisplayReference: null,
    contractId: null,
    contractDisplayReference: null,
    invoiceId: null,
    invoiceDisplayReference: null,
    noteId: null,
    noteReference: null,
    issuerOrganizationId: "org-1",
    issuerName: "Toyota",
    status: "ACTIVE",
    amount: null,
    updatedAt: "2026-08-30T08:36:00.000Z",
    ...overrides,
  };
}

describe("paymaster financing row helpers", () => {
  it("classifies notes and facilities", () => {
    const note = row({ noteId: "n1", noteReference: "NT-1" });
    const facility = row({ contractId: "c1", contractDisplayReference: "FAC-1" });
    expect(isPaymasterNoteRow(note)).toBe(true);
    expect(isPaymasterFacilityRow(note)).toBe(false);
    expect(isPaymasterFacilityRow(facility)).toBe(true);
    expect(paymasterFinancingKind(note)).toBe("Note");
    expect(paymasterFinancingKind(facility)).toBe("Facility");
  });

  it("prefers note reference and links to the note or facility", () => {
    const note = row({
      noteId: "n/1",
      noteReference: "NT-9",
      contractDisplayReference: "FAC-1",
    });
    expect(paymasterFinancingTitle(note)).toBe("NT-9");
    expect(paymasterFinancingHref(note)).toBe("/notes/n%2F1");
    expect(paymasterFinancingHref(row({ contractId: "c 1" }))).toBe("/contracts/c%201");
    expect(paymasterFinancingHref(row({ applicationId: "a1" }))).toBeNull();
  });
});
