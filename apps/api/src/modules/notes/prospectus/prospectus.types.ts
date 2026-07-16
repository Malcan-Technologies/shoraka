/**
 * SECTION: Legacy page-1 Canva POC types
 * WHY: Kept for existing PDF script only
 *
 * Active Note Identity work: prospectus-note-identity.types.ts
 * Future field research: prospectus-future-stages.field-sources.ts
 */

export interface ProspectusMetaItem {
  label: string;
  value: string;
}

export interface ProspectusRiskRating {
  grade: string;
  levelLabel: string;
  description: string;
  scaleLinkLabel: string;
}

export interface ProspectusSummaryRow {
  label: string;
  value: string;
}

export interface ProspectusHighlight {
  title: string;
  description: string;
}

export interface ProspectusGlanceMetric {
  label: string;
  value: string;
}

export interface ProspectusTrackRecordMetric {
  label: string;
  value: string;
}

export interface ProspectusHistoricalNoteRow {
  noteId: string;
  financingType: string;
  amountRm: string;
  tenure: string;
  profitRatePa: string;
  status: string;
  repaymentDate: string;
}

export interface ProspectusPage1Data {
  brandName: string;
  tagline: string;
  complianceBadge: string;
  documentTitle: string;
  noteReference: string;
  financingTypeLabel: string;
  financingTypeBlurb: string;
  metaItems: ProspectusMetaItem[];
  riskRating: ProspectusRiskRating;
  investmentSummary: ProspectusSummaryRow[];
  keyHighlights: ProspectusHighlight[];
  atAGlance: ProspectusGlanceMetric[];
  trackRecordHeading: string;
  trackRecordMetrics: ProspectusTrackRecordMetric[];
  historicalNotes: ProspectusHistoricalNoteRow[];
  trackRecordDisclaimer: string;
  footerDisclaimer: string;
}
