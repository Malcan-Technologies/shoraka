/**
 * SECTION: Prospectus Page 1 — Note Identity (DATA STAGE 1)
 * WHY: Isolate top-left Canva block: title, note reference, financing type, description
 */

export const PROSPECTUS_DATA_NOT_AVAILABLE = "Data not available";

/** Static prospectus section title — not a database field. */
export const PROSPECTUS_INVESTMENT_NOTE_LABEL = "INVESTMENT NOTE";

export interface ProspectusNoteIdentity {
  /** Always static prospectus wording. */
  investmentNoteLabel: string;
  /** From notes.note_reference only. */
  noteReference: string;
  /** From notes.product_snapshot.product_name only. */
  financingType: string;
  /**
   * Short financing/product description.
   * Not present on Note today → PROSPECTUS_DATA_NOT_AVAILABLE until frozen into snapshot.
   */
  description: string;
}

export interface ProspectusNoteIdentityFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "not_stored";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_NOTE_IDENTITY_FIELD_SOURCES: Record<
  keyof ProspectusNoteIdentity,
  ProspectusNoteIdentityFieldSource
> = {
  investmentNoteLabel: {
    label: "Investment Note",
    canonicalSource: "static text: INVESTMENT NOTE",
    availability: "static",
    possibleAlternatives: "none",
    notes: "Prospectus document heading. Not in Prisma, Product, or Note DTOs.",
  },
  noteReference: {
    label: "Note reference",
    canonicalSource: "notes.note_reference",
    availability: "stored",
    possibleAlternatives:
      "formatNoteReferenceDisplay() changes display shape only; do not use as a data source",
    notes: "API: NoteListItem.noteReference via mapNoteListItem. No automatic fallback.",
  },
  financingType: {
    label: "Financing type",
    canonicalSource: "notes.product_snapshot.product_name",
    availability: "stored",
    possibleAlternatives:
      "product_snapshot.name / productName / productLabel (mapper aliases); live Product.workflow name — not used",
    notes:
      "Written at note create from Product.workflow name. If product_name missing → Data not available.",
  },
  description: {
    label: "Description",
    canonicalSource: "none on Note",
    availability: "not_stored",
    possibleAlternatives:
      "live Product.workflow[0].config.description (admin financing-type config; issuer product cards)",
    notes:
      "application.financing_type stores only product_id. Note create does not copy description into product_snapshot.",
  },
};
