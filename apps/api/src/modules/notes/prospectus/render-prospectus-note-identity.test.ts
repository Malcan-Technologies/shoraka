import {
  buildProspectusNoteIdentity,
  formatProspectusFinancingTypeDisplay,
} from "./prospectus-note-identity";
import { SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT } from "./prospectus-note-identity.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVESTMENT_NOTE_LABEL,
  PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES,
} from "./prospectus-note-identity.types";
import { buildProspectusNoteIdentityDocument } from "./render-prospectus-note-identity";

describe("prospectus Note Identity (Page 1 DATA STAGE 1)", () => {
  it("documents raw NOTE reference and frozen description sources", () => {
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.investmentNoteLabel.availability).toBe("static");
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.noteReference.canonicalSource).toBe(
      "notes.note_reference"
    );
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.financingType.canonicalSource).toBe(
      "notes.product_snapshot.product_name"
    );
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.description.canonicalSource).toBe(
      "notes.product_snapshot.description"
    );
  });

  it("displays raw NOTE reference and does not convert to ARF", () => {
    const data = buildProspectusNoteIdentity(SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT);
    expect(data.investmentNoteLabel).toBe(PROSPECTUS_INVESTMENT_NOTE_LABEL);
    expect(data.noteReference).toBe("NOTE-20250515-0187ABCD");
    expect(data.noteReference).not.toMatch(/^ARF-/);
    expect(data.noteReference).not.toMatch(/^Note /);
  });

  it("uppercases financing type for display without changing the stored input value", () => {
    const stored = "Accounts Receivable Financing-i";
    expect(formatProspectusFinancingTypeDisplay(stored)).toBe(
      "ACCOUNTS RECEIVABLE FINANCING-I"
    );
    const data = buildProspectusNoteIdentity({
      ...SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT,
      productSnapshotProductName: stored,
    });
    expect(data.financingType).toBe("ACCOUNTS RECEIVABLE FINANCING-I");
    expect(SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT.productSnapshotProductName).toBe(stored);
  });

  it("uses frozen product_snapshot.description and ignores live Product description", () => {
    const withDescription = buildProspectusNoteIdentity(SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT);
    expect(withDescription.description).toBe(
      "Short-term financing secured against approved receivables."
    );
    expect(withDescription.description).not.toContain("LIVE PRODUCT");

    const oldNote = buildProspectusNoteIdentity({
      ...SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT,
      productSnapshotDescription: null,
      liveProductDescription: "Should not appear",
    });
    expect(oldNote.description).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders Canva-facing identity lines", () => {
    const html = buildProspectusNoteIdentityDocument();
    expect(html).toContain("INVESTMENT NOTE");
    expect(html).toContain("Note ID: NOTE-20250515-0187ABCD");
    expect(html).toContain("Financing Type: ACCOUNTS RECEIVABLE FINANCING-I");
    expect(html).toContain("Product Description: Short-term financing secured against approved receivables.");
    expect(html).not.toContain("ARF-");
    expect(html).not.toContain("LIVE PRODUCT");
  });
});
