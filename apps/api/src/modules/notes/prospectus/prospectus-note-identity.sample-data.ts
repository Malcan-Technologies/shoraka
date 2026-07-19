/**
 * SECTION: Sample Note Identity for Stage 1 preview
 * WHY: Raw NOTE ref; stored title-case product_name; frozen description present
 */

import { buildProspectusNoteIdentity } from "./prospectus-note-identity";
import type {
  ProspectusNoteIdentity,
  ProspectusNoteIdentityInput,
} from "./prospectus-note-identity.types";

export const SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT: ProspectusNoteIdentityInput = {
  noteReference: "NOTE-20250515-0187ABCD",
  productSnapshotProductName: "Accounts Receivable Financing-i",
  productSnapshotDescription:
    "Short-term financing secured against approved receivables.",
  liveProductDescription: "LIVE PRODUCT DESCRIPTION MUST NOT APPEAR",
};

export const SAMPLE_PROSPECTUS_NOTE_IDENTITY: ProspectusNoteIdentity =
  buildProspectusNoteIdentity(SAMPLE_PROSPECTUS_NOTE_IDENTITY_INPUT);
