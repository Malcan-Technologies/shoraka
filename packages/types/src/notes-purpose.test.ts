import {
  formatNoteReferenceDisplay,
  getNoteHeaderPurposeRows,
  resolveContractPurpose,
  resolveContractTitle,
  resolvePurposeOfFinancing,
  toMarketplacePublicNote,
} from "./notes";

describe("note purpose helpers", () => {
  it("reads frozen financing_for and ignores blank snapshots", () => {
    expect(resolvePurposeOfFinancing({ financing_for: "  Working capital  " })).toBe(
      "Working capital"
    );
    expect(resolvePurposeOfFinancing({ financing_for: "   " })).toBeNull();
    expect(resolvePurposeOfFinancing(null)).toBeNull();
  });

  it("reads contract description from the frozen contract_details path", () => {
    expect(
      resolveContractPurpose({
        contract_details: { description: "  Repair and maintenance  " },
      })
    ).toBe("Repair and maintenance");
    expect(resolveContractPurpose({ description: "Top-level fallback" })).toBe(
      "Top-level fallback"
    );
    expect(resolveContractPurpose({ contract_details: { title: "Only a title" } })).toBeNull();
    expect(
      resolveContractTitle({
        contract_details: { title: "  Mining Rig Repair 12654  " },
      })
    ).toBe("Mining Rig Repair 12654");
  });

  it("strips issuer identity from marketplace notes and prefers purpose as the title", () => {
    const published = toMarketplacePublicNote({
      issuerName: "Acme Sdn Bhd",
      title: "Note for invoice 1001 - Acme Sdn Bhd",
      noteReference: "NOTE-20260821-ABC",
      purposeOfFinancing: "  Working capital for a new contract  ",
    });

    expect(published.issuerName).toBeNull();
    expect(published.purposeOfFinancing).toBe("Working capital for a new contract");
    expect(published.title).toBe("Working capital for a new contract");
    expect(formatNoteReferenceDisplay(published.noteReference)).toBe("Note 20260821-ABC");
  });

  it("builds labeled header rows for contract and invoice purpose", () => {
    expect(
      getNoteHeaderPurposeRows({
        purposeOfFinancing: "  Working capital for a new contract  ",
        purposeSnapshot: { financing_for: "Ignored when list field is present" },
        contractSnapshot: {
          contract_details: { description: "  Repair and maintenance for 12 mining rigs  " },
        },
      })
    ).toEqual([
      {
        label: "Purpose of contract",
        value: "Repair and maintenance for 12 mining rigs",
      },
      {
        label: "Purpose of invoice",
        value: "Working capital for a new contract",
      },
    ]);
    expect(
      getNoteHeaderPurposeRows({
        purposeSnapshot: { financing_for: "Invoice-backed working capital" },
        contractSnapshot: null,
      })
    ).toEqual([{ label: "Purpose of invoice", value: "Invoice-backed working capital" }]);
    expect(
      getNoteHeaderPurposeRows({
        purposeOfFinancing: "   ",
        purposeSnapshot: { financing_for: "" },
        contractSnapshot: { contract_details: { title: "Supply agreement" } },
      })
    ).toEqual([]);
  });

  it("falls back to the note reference when purpose is missing", () => {
    const published = toMarketplacePublicNote({
      issuerName: "Acme Sdn Bhd",
      title: "Note for invoice 1001 - Acme Sdn Bhd",
      noteReference: "NOTE-20260821-ABC",
      purposeOfFinancing: null,
    });

    expect(published.issuerName).toBeNull();
    expect(published.title).toBe("Note 20260821-ABC");
    expect(published.purposeOfFinancing).toBeNull();
  });
});
