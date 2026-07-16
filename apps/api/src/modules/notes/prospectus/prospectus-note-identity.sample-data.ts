/**
 * SECTION: Sample Note Identity values for plain HTML preview
 * WHY: Prove display wiring without Prisma; description intentionally unavailable
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVESTMENT_NOTE_LABEL,
  type ProspectusNoteIdentity,
} from "./prospectus-note-identity.types";

/**
 * Sample represents stored Note fields only.
 * financingType stands in for product_snapshot.product_name (not Canva marketing blurb).
 * description is Data not available — not frozen on Note.
 */
export const SAMPLE_PROSPECTUS_NOTE_IDENTITY: ProspectusNoteIdentity = {
  investmentNoteLabel: PROSPECTUS_INVESTMENT_NOTE_LABEL,
  noteReference: "NOTE-20250515-0187ABCD",
  financingType: "Accounts Receivable Financing-i",
  description: PROSPECTUS_DATA_NOT_AVAILABLE,
};
