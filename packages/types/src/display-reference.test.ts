import {
  formatApplicationNotificationRef,
  formatApplicationReference,
  formatContractReference,
  formatInvoiceReference,
  formatNoteReference,
  formatOrganizationReference,
  formatSettlementReference,
  formatWithdrawalReference,
} from "./display-reference";

describe("display-reference formatters", () => {
  it("prefers canonical application reference", () => {
    expect(
      formatApplicationReference({
        displayReference: "APP-ARF-202608-A82",
        id: "clxxxxxxxx",
      })
    ).toBe("APP-ARF-202608-A82");
  });

  it("falls back to short application id", () => {
    expect(formatApplicationReference({ id: "clabcdefghijklmnop" })).toBe("#IJKLMNOP");
  });

  it("shows contract canonical reference separately from business number", () => {
    expect(
      formatContractReference({
        displayReference: "CON-ARF-202608-B11",
        businessNumber: "CNT-2026-001",
        id: "contract_id",
      })
    ).toBe("CON-ARF-202608-B11");
    expect(
      formatContractReference({
        businessNumber: "CNT-2026-001",
        id: "contract_id",
      })
    ).toBe("CNT-2026-001");
  });

  it("shows invoice canonical reference separately from invoice number", () => {
    expect(
      formatInvoiceReference({
        displayReference: "INV-ARF-202608-0N5",
        businessNumber: "INV-2026-0018",
        id: "invoice_id",
      })
    ).toBe("INV-ARF-202608-0N5");
    expect(
      formatInvoiceReference({
        businessNumber: "INV-2026-0018",
        id: "invoice_id",
      })
    ).toBe("INV-2026-0018");
  });

  it("uses noteReference for notes", () => {
    expect(formatNoteReference({ noteReference: "NOTE-ARF-202608-Z91", id: "note_id" })).toBe(
      "NOTE-ARF-202608-Z91"
    );
  });

  it("formats settlement and product-linked withdrawal references", () => {
    expect(
      formatSettlementReference({
        displayReference: "SET-ARF-202608-A52",
        id: "settlement_id",
      })
    ).toBe("SET-ARF-202608-A52");
    expect(
      formatWithdrawalReference({
        displayReference: "WDL-ARF-202608-P30",
        id: "withdrawal_id",
      })
    ).toBe("WDL-ARF-202608-P30");
  });

  it("keeps account-level withdrawal fallback when canonical ref is null", () => {
    expect(formatWithdrawalReference({ id: "abcdefghijklmnop" })).toBe("#IJKLMNOP");
  });

  it("accepts account-scoped WDL canonical reference without transformation", () => {
    expect(
      formatWithdrawalReference({
        displayReference: "WDL-202608-X7A",
        id: "withdrawal_id",
      })
    ).toBe("WDL-202608-X7A");
  });

  it("formats organization references", () => {
    expect(
      formatOrganizationReference({
        displayReference: "ISS-202608-D7F",
        id: "org_id",
      })
    ).toBe("ISS-202608-D7F");
  });

  it("formats notification refs with canonical preference", () => {
    expect(
      formatApplicationNotificationRef({
        displayReference: "APP-ARF-202608-A82",
        id: "app_id",
      })
    ).toBe("APP-ARF-202608-A82");
    expect(formatApplicationNotificationRef({ id: "clabcdefghijklmnop" })).toBe("#JKLMNOPQ");
  });
});
