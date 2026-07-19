/**
 * SECTION: Prospectus Page 1 — Note Identity (DATA STAGE 1)
 * WHY: Static heading; raw NOTE reference; uppercase financing type display; frozen description
 */

export const PROSPECTUS_DATA_NOT_AVAILABLE = "Data not available";

/** Static prospectus section title — not a database field. */
export const PROSPECTUS_INVESTMENT_NOTE_LABEL = "INVESTMENT NOTE";

export interface ProspectusNoteIdentity {
  investmentNoteLabel: string;
  /** Raw notes.note_reference — never formatNoteReferenceDisplay / ARF. */
  noteReference: string;
  /** Presentation uppercase of product_snapshot.product_name. */
  financingType: string;
  /** Frozen notes.product_snapshot.description. */
  description: string;
}

export interface ProspectusNoteIdentityInput {
  noteReference: string | null | undefined;
  /** notes.product_snapshot.product_name — stored value; display uppercased separately. */
  productSnapshotProductName: string | null | undefined;
  /** notes.product_snapshot.description — frozen at create. */
  productSnapshotDescription: string | null | undefined;
  /** Observational only — must not be used as fallback. */
  liveProductDescription?: string | null;
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
    label: "Note ID",
    canonicalSource: "notes.note_reference",
    availability: "stored",
    possibleAlternatives:
      "formatNoteReferenceDisplay() changes display shape only; ARF conversion — not used",
    notes: "Display raw NOTE-... value. No prospectus-specific reference.",
  },
  financingType: {
    label: "Financing Type",
    canonicalSource: "notes.product_snapshot.product_name",
    availability: "stored",
    possibleAlternatives: "live Product.workflow name — not used",
    notes:
      "Stored product_name unchanged. Prospectus display is uppercase presentation only.",
  },
  description: {
    label: "Product Description",
    canonicalSource: "notes.product_snapshot.description",
    availability: "stored",
    possibleAlternatives:
      "live Product financing-type config.description at render time — not used",
    notes:
      "Frozen at Note create from financing_type step config.description. Old Notes without field → Data not available.",
  },
};
