/**
 * SECTION: Prospectus Page 2 assembled view-model
 * WHY: One A4 page composed from Stage 1–8 builders
 */

import type { ProspectusCreditInsights } from "./prospectus-credit-insights.types";
import type { ProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics.types";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import type { ProspectusFooter } from "./prospectus-footer.types";
import type { ProspectusHeader } from "./prospectus-header.types";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";
import type { ProspectusInvoicePaymaster } from "./prospectus-invoice-paymaster.types";
import type { ProspectusInvoiceWorkNarrative } from "./prospectus-invoice-work-narrative.types";
import type { ProspectusIssuerProfile } from "./prospectus-issuer-profile.types";
import type { ProspectusPaymasterTrackRecord } from "./prospectus-paymaster-track-record.types";
import type { ProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale.types";

/** Same A4 dimensions as Page 1. */
export const PROSPECTUS_PAGE_TWO_WIDTH_MM = 210;
export const PROSPECTUS_PAGE_TWO_HEIGHT_MM = 297;

export type ProspectusPageTwoFinancialMode =
  | "frozen_publication_snapshot"
  | "live_unpublished_preview"
  | "published_unavailable";

export interface ProspectusPageTwo {
  header: ProspectusHeader;
  issuerProfile: ProspectusIssuerProfile;
  invoicePaymaster: ProspectusInvoicePaymaster;
  paymasterTrackRecord: ProspectusPaymasterTrackRecord;
  /** Stage 4A source/year model — not rendered as a duplicate final section. */
  financialComparisonSource: ProspectusFinancialComparisonSource;
  financialComparisonMetrics: ProspectusFinancialComparisonMetrics;
  creditInsights: ProspectusCreditInsights;
  invoiceWorkNarrative: ProspectusInvoiceWorkNarrative;
  soukscoreRatingScale: ProspectusSoukscoreRatingScale;
  investmentCta: ProspectusInvestmentCta;
  footer: ProspectusFooter;
  /** Audit-only render metadata — omitted from Canva HTML. */
  meta: {
    noteId: string;
    noteReference: string;
    financialMode: ProspectusPageTwoFinancialMode;
    isPublished: boolean;
  };
}
