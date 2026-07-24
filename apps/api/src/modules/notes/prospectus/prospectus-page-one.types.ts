/**
 * SECTION: Prospectus Page 1 assembled view-model
 * WHY: One typed result for all Stage 1–8 builders after Prisma mapping
 */

import type { ProspectusAtAGlance } from "./prospectus-at-a-glance.types";
import type { ProspectusDatesPaymaster } from "./prospectus-dates-paymaster.types";
import type { ProspectusHistoricalNoteTable } from "./prospectus-historical-note-table.types";
import type { ProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight.types";
import type { ProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record.types";
import type { ProspectusMainFinancialTerms } from "./prospectus-main-financial-terms.types";
import type { ProspectusNoteIdentity } from "./prospectus-note-identity.types";
import type { ProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight.types";
import type { ProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah.types";
import type { ProspectusReturnHighlight } from "./prospectus-return-highlight.types";
import type { ProspectusRiskAssessment } from "./prospectus-risk-assessment.types";
import type { ProspectusShariahHighlight } from "./prospectus-shariah-highlight.types";
import type { ProspectusTimingPurpose } from "./prospectus-timing-purpose.types";

export type ProspectusPageOneTrackRecordMode =
  | "frozen_publication_snapshot"
  | "live_unpublished_preview"
  | "published_unavailable";

export interface ProspectusPageOne {
  noteIdentity: ProspectusNoteIdentity;
  datesPaymaster: ProspectusDatesPaymaster;
  riskAssessment: ProspectusRiskAssessment;
  mainFinancialTerms: ProspectusMainFinancialTerms;
  timingPurpose: ProspectusTimingPurpose;
  paymentBasisShariah: ProspectusPaymentBasisShariah;
  paymasterHighlight: ProspectusPaymasterHighlight;
  issuerFundamentalsHighlight: ProspectusIssuerFundamentalsHighlight;
  returnHighlight: ProspectusReturnHighlight;
  shariahHighlight: ProspectusShariahHighlight;
  atAGlance: ProspectusAtAGlance;
  issuerTrackRecord: ProspectusIssuerTrackRecord;
  historicalNoteTable: ProspectusHistoricalNoteTable;
  /** Assembly metadata — not rendered in Canva HTML. */
  meta: {
    noteId: string;
    trackRecordMode: ProspectusPageOneTrackRecordMode;
  };
}

/** A4 page size from existing prospectus-page1.html.ts convention. */
export const PROSPECTUS_PAGE_ONE_WIDTH_MM = 210;
export const PROSPECTUS_PAGE_ONE_HEIGHT_MM = 297;
