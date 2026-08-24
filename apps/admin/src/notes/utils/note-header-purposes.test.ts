import { getNoteHeaderPurposeRows } from "./note-header-purposes";

describe("getNoteHeaderPurposeRows", () => {
  it("shows contract and invoice purposes as labeled header rows", () => {
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
  });

  it("falls back to the purpose snapshot when the list field is missing", () => {
    expect(
      getNoteHeaderPurposeRows({
        purposeSnapshot: { financing_for: "Invoice-backed working capital" },
        contractSnapshot: null,
      })
    ).toEqual([{ label: "Purpose of invoice", value: "Invoice-backed working capital" }]);
  });

  it("omits blank rows", () => {
    expect(
      getNoteHeaderPurposeRows({
        purposeOfFinancing: "   ",
        purposeSnapshot: { financing_for: "" },
        contractSnapshot: { contract_details: { title: "Supply agreement" } },
      })
    ).toEqual([]);
  });
});
