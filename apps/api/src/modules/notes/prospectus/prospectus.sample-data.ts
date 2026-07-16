/**
 * SECTION: Legacy page-1 Canva POC sample data
 * WHY: Kept for existing PDF script; Note Identity uses prospectus-note-identity.sample-data.ts
 */

import { SAMPLE_PROSPECTUS_NOTE_IDENTITY } from "./prospectus-note-identity.sample-data";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPage1Data } from "./prospectus.types";

/** @deprecated Prefer SAMPLE_PROSPECTUS_NOTE_IDENTITY for Page 1 DATA STAGE 1. */
export const SAMPLE_PROSPECTUS_PAGE1_DATA: ProspectusPage1Data = {
  brandName: "CashSouk",
  tagline: "Invest in Growth. Earn with Purpose.",
  complianceBadge: "Shariah Compliant",
  documentTitle: SAMPLE_PROSPECTUS_NOTE_IDENTITY.investmentNoteLabel,
  noteReference: SAMPLE_PROSPECTUS_NOTE_IDENTITY.noteReference,
  financingTypeLabel: SAMPLE_PROSPECTUS_NOTE_IDENTITY.financingType,
  financingTypeBlurb: PROSPECTUS_DATA_NOT_AVAILABLE,
  metaItems: [],
  riskRating: {
    grade: PROSPECTUS_DATA_NOT_AVAILABLE,
    levelLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
    description: PROSPECTUS_DATA_NOT_AVAILABLE,
    scaleLinkLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
  },
  investmentSummary: [],
  keyHighlights: [],
  atAGlance: [],
  trackRecordHeading: PROSPECTUS_DATA_NOT_AVAILABLE,
  trackRecordMetrics: [],
  historicalNotes: [],
  trackRecordDisclaimer: PROSPECTUS_DATA_NOT_AVAILABLE,
  footerDisclaimer: PROSPECTUS_DATA_NOT_AVAILABLE,
};
