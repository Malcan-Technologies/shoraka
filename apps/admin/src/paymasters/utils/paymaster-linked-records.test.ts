import {
  isPaymasterFacilityRow,
  isPaymasterNoteRow,
  paymasterApplicationReviewHref,
  paymasterFinancingHref,
  paymasterFinancingKind,
  paymasterFinancingTitle,
  uniquePaymasterApplicationCount,
} from "./paymaster-linked-records";
import type { PaymasterFinancingRow, PaymasterLinkedApplicationRow } from "@cashsouk/types";

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

function application(
  overrides: Partial<PaymasterLinkedApplicationRow> & Pick<PaymasterLinkedApplicationRow, "id">
): PaymasterLinkedApplicationRow {
  return {
    reference: overrides.id,
    issuerOrganizationId: "org-1",
    issuerName: "Toyota",
    productType: "Facility financing",
    status: "SUBMITTED",
    updatedAt: "2026-09-03T00:00:00.000Z",
    productId: "prod-1",
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

describe("paymaster linked applications", () => {
  it("opens Admin Application Review through the existing route helper", () => {
    expect(paymasterApplicationReviewHref("prod-1", "app-1")).toBe("/applications/prod-1/app-1");
    expect(paymasterApplicationReviewHref("a/b", "c d")).toBe("/applications/a%2Fb/c%20d");
    expect(paymasterApplicationReviewHref(null, "app-1")).toBeNull();
    expect(paymasterApplicationReviewHref("prod-1", null)).toBeNull();
  });

  it("counts unique applications only", () => {
    expect(
      uniquePaymasterApplicationCount([
        application({ id: "app-1" }),
        application({ id: "app-1", reference: "APP-DUPLICATE" }),
        application({ id: "app-2", productType: "Invoice financing" }),
      ])
    ).toBe(2);
  });
});
