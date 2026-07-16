import { SAMPLE_PROSPECTUS_NOTE_IDENTITY } from "./prospectus-note-identity.sample-data";
import { buildProspectusNoteIdentityHtml } from "./prospectus-note-identity.html";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVESTMENT_NOTE_LABEL,
  PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES,
} from "./prospectus-note-identity.types";
import { buildProspectusNoteIdentityDocument } from "./render-prospectus-note-identity";

describe("prospectus Note Identity (Page 1 DATA STAGE 1)", () => {
  it("uses static INVESTMENT NOTE label and note_reference / product_name sources", () => {
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.investmentNoteLabel.availability).toBe("static");
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.noteReference.canonicalSource).toBe(
      "notes.note_reference"
    );
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.financingType.canonicalSource).toBe(
      "notes.product_snapshot.product_name"
    );
    expect(PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES.description.availability).toBe("not_stored");
  });

  it("sample identity shows Data not available for description", () => {
    expect(SAMPLE_PROSPECTUS_NOTE_IDENTITY.investmentNoteLabel).toBe(PROSPECTUS_INVESTMENT_NOTE_LABEL);
    expect(SAMPLE_PROSPECTUS_NOTE_IDENTITY.description).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with the four Note Identity lines", () => {
    const html = buildProspectusNoteIdentityDocument();

    expect(html).toContain("Investment Note: INVESTMENT NOTE");
    expect(html).toContain(`Note reference: ${SAMPLE_PROSPECTUS_NOTE_IDENTITY.noteReference}`);
    expect(html).toContain(`Financing type: ${SAMPLE_PROSPECTUS_NOTE_IDENTITY.financingType}`);
    expect(html).toContain(`Description: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain("notes.note_reference");
    expect(html).toContain("notes.product_snapshot.product_name");
    expect(buildProspectusNoteIdentityHtml(SAMPLE_PROSPECTUS_NOTE_IDENTITY)).toContain("<table");
  });
});
