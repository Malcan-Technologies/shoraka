/**
 * SECTION: Boss-review alignment regressions for prospectus Pages 1–3
 * WHY: Lock portal-consistent return, issuer privacy, and preview-only placeholders
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  formatInvestorReturnRatePercent,
  recommendPaymasterHighlight,
  resolveNetExpectedReturnRatePercent,
} from "@cashsouk/types";
import { buildProspectusDatesPaymaster } from "./prospectus-dates-paymaster";
import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import { buildProspectusMainFinancialTerms } from "./prospectus-main-financial-terms";
import { buildProspectusIssuerProfile } from "./prospectus-issuer-profile";
import { buildProspectusPageThreeMetadata } from "./prospectus-page-three-metadata";
import { SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT } from "./prospectus-page-three-metadata.sample-data";
import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE } from "./prospectus-financial-comparison-source.sample-data";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import { buildProspectusCreditInsights } from "./prospectus-credit-insights";
import { buildProspectusInvoiceWorkNarrative } from "./prospectus-invoice-work-narrative";
import { buildProspectusPageThreeInvestorTakeaways } from "./prospectus-page-three-investor-takeaways";
import { SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT } from "./prospectus-page-three-investor-takeaways.sample-data";
import { PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS } from "./prospectus-page-three-investor-takeaways.types";
import { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } from "./prospectus-placeholder-publication-content";
import { buildProspectusHeader } from "./prospectus-header";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "./prospectus-page-two.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "./prospectus-page-three.sample-data";
import { renderProspectusPageThreeHtml } from "./render-prospectus-page-three";
import { renderProspectusPageTwoHtml } from "./render-prospectus-page-two";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import { buildProspectusDatesPaymasterDocument } from "./render-prospectus-dates-paymaster";

describe("prospectus boss-review alignment", () => {
  describe("Page 1 dates and expected return", () => {
    it("renders Listing → Closing → Maturity → Paymaster with duration on Closing Date", () => {
      const data = buildProspectusDatesPaymaster(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT);
      const html = buildProspectusDatesPaymasterDocument(data);
      const listingIdx = html.indexOf("Listing Date:");
      const closingIdx = html.indexOf("Closing Date:");
      const maturityIdx = html.indexOf("Maturity Date:");
      const paymasterIdx = html.indexOf("Paymaster:");
      expect(listingIdx).toBeGreaterThan(-1);
      expect(closingIdx).toBeGreaterThan(listingIdx);
      expect(maturityIdx).toBeGreaterThan(closingIdx);
      expect(paymasterIdx).toBeGreaterThan(maturityIdx);
      expect(data.closingDate).toMatch(/\(\d+ days\)$/);
    });

    it("matches investor portal net expected return helper with no local formula", () => {
      const profitRatePercent = 12;
      const serviceFeeRatePercent = 10;
      const portal = resolveNetExpectedReturnRatePercent({
        profitRatePercent,
        serviceFeeRatePercent,
      });
      const terms = buildProspectusMainFinancialTerms({
        targetAmount: 500_000,
        profitRatePercent,
        serviceFeeRatePercent,
      });
      expect(terms.expectedReturnForInvestmentPeriod).toBe(
        formatInvestorReturnRatePercent(portal)
      );
      expect(terms.expectedReturnForInvestmentPeriod).toBe("10.8%");

      const mainSource = readFileSync(
        join(__dirname, "prospectus-main-financial-terms.ts"),
        "utf8"
      );
      expect(mainSource).toContain("resolveNetExpectedReturnRatePercent");
      expect(mainSource).not.toMatch(/activated_at/);
      expect(mainSource).not.toMatch(/\/\s*365/);
    });
  });

  describe("issuer privacy", () => {
    it("omits company name and registration from Page 2 profile", () => {
      const profile = buildProspectusIssuerProfile({
        issuerSnapshot: {
          name: "Secret Issuer Sdn Bhd",
          registration_number: "201401012345",
          industry: "Construction",
          entity_type: "PRIVATE_LIMITED",
          business_description: "Secret Issuer Sdn Bhd — Bridge works.",
        },
      });
      expect(profile).not.toHaveProperty("companyName");
      expect(profile).not.toHaveProperty("registrationNumber");
      expect(profile).not.toHaveProperty("entityType");
      expect(profile.industry).toBe("Construction");
      expect(profile.companySize).toBe("Data not available");
      expect(profile).not.toHaveProperty("industryAndCompanySize");
      const withSize = buildProspectusIssuerProfile({
        issuerSnapshot: {
          name: "Secret Issuer Sdn Bhd",
          industry: "Construction",
          business_description: "Secret Issuer Sdn Bhd — Bridge works.",
        },
        officerCompanySize: "Medium",
      });
      expect(withSize.industry).toBe("Construction");
      expect(withSize.companySize).toBe("Medium");
      expect(profile.businessDescription).toBe("Bridge works.");
      expect(profile.businessDescription).not.toContain("Secret Issuer");
    });

    it("omits Issuer from Page 3 metadata strip; keeps shared Shariah badge", () => {
      const meta = buildProspectusPageThreeMetadata({
        ...SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT,
        issuerName: "ABC Engineering Sdn Bhd",
        financialSource: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE,
      });
      expect(meta.metadata).not.toHaveProperty("issuer");
      const html = renderProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
      expect(html).not.toContain("Issuer:");
      expect(html).toContain("Shariah Status Badge:");
      expect(html).toContain('class="shariah-badge"');
      const pageThreeHtmlSource = readFileSync(
        join(__dirname, "prospectus-page-three.html.ts"),
        "utf8"
      );
      expect(pageThreeHtmlSource).toContain("buildProspectusHeaderHtml");
      expect(pageThreeHtmlSource).not.toMatch(/function renderHeader/);
    });
  });

  describe("preview-only placeholders", () => {
    it("preview samples render four highlights and four invoice statements", () => {
      const highlights = PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.keyInvestorHighlights;
      expect(highlights).toHaveLength(4);
      expect(highlights.map((h) => h.key)).toEqual([
        "paymaster",
        "issuer_fundamentals",
        "return",
        "shariah",
      ]);

      // Paymaster title uses the shared recommendation wording (not obsolete "Placeholder …" titles).
      const expectedPaymaster = recommendPaymasterHighlight({
        paymasterSnapshot: {
          name: "Ministry of Finance Malaysia",
          entity_type: "Federal Government Agency",
        },
      });
      expect(SAMPLE_PROSPECTUS_PAGE_ONE.paymasterHighlight.highlightTitle).toBe(
        expectedPaymaster.title
      );
      expect(SAMPLE_PROSPECTUS_PAGE_ONE.paymasterHighlight.highlightTitle).toBe(
        highlights.find((h) => h.key === "paymaster")?.title
      );
      expect(SAMPLE_PROSPECTUS_PAGE_ONE.paymasterHighlight.highlightTitle).not.toMatch(
        /^Placeholder\b/i
      );
      expect(SAMPLE_PROSPECTUS_PAGE_ONE.shariahHighlight.highlightTitle).toBe(
        PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title
      );

      expect(
        PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.invoiceWorkStatements.filter(
          (s) => s.isVisible
        )
      ).toHaveLength(4);
      // Preview sample uses Canva-shaped officer wording (still development placeholder content).
      expect(
        SAMPLE_PROSPECTUS_PAGE_TWO.invoiceWorkNarrative.workUnderContractStatement
      ).toContain("civil engineering and infrastructure works");
    });

    it("Prisma mapper sources do not import placeholder defaults", () => {
      for (const file of [
        "prospectus-page-one-mapper.ts",
        "prospectus-page-two-mapper.ts",
        "prospectus-page-three-mapper.ts",
      ]) {
        const source = readFileSync(join(__dirname, file), "utf8");
        expect(source).not.toContain("PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT");
      }
    });

    it("Credit Insights placeholder selections resolve Canva labels; production stays DNA", () => {
      const preview = buildProspectusCreditInsights({
        creditInsightSelections:
          PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.creditInsightSelections,
      });
      expect(preview.creditScore).toBe("Good");
      expect(preview.creditUtilisation).toBe("Healthy");
      expect(preview.litigationCheck).toBe("Clear");
      expect(preview.ccrisStatus).toBe("No record");
      expect(preview).not.toHaveProperty("omittedFields");

      const production = buildProspectusCreditInsights({});
      expect(production.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    });

    it("invoice work production remains safe without selections", () => {
      const production = buildProspectusInvoiceWorkNarrative({});
      expect(production.workUnderContractStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    });
  });

  describe("investor takeaways", () => {
    it("keeps six fixed categories and rejects value-derived narrative", () => {
      const data = buildProspectusPageThreeInvestorTakeaways({
        ...SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT,
        investorTakeawayOptions:
          PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.investorTakeawayOptions,
        investorTakeawaySelections:
          PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.investorTakeawaySelections,
      });
      expect(data.items.map((i) => i.key)).toEqual([
        ...PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS,
      ]);
      expect(data.omittedKeys).toContain("leverage");
      expect(data.items[0]?.takeaway).toContain("Placeholder");
      expect(JSON.stringify(data)).not.toMatch(/steady growth|strong investment/i);
    });
  });

  describe("financial manual fills", () => {
    it("fills unsupported gross profit only; does not mutate source years", () => {
      const source = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE;
      const before = JSON.stringify(source.years);
      const income = buildProspectusPageThreeIncomeStatement({
        financialSource: source,
        prospectusFinancialInputs:
          PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT.prospectusFinancialInputs,
      });
      const gross = income.rows.find((r) => r.key === "gross_profit");
      expect(gross?.values[0]).toBe("RM 2,100,000.00");
      const revenue = income.rows.find((r) => r.key === "revenue");
      expect(revenue?.values[0]).not.toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(JSON.stringify(source.years)).toBe(before);
    });
  });

  describe("SoukScore scale", () => {
    it("keeps marketplace AAA–B grades on Page 2 sample", () => {
      const grades = SAMPLE_PROSPECTUS_PAGE_TWO.soukscoreRatingScale.grades.map(
        (g) => g.grade
      );
      expect(grades).toEqual(["AAA", "AA", "A", "BBB", "BB", "B"]);
      expect(grades).not.toContain("A-");
    });
  });

  describe("shared header", () => {
    it("keeps Page 2/3 header fields aligned with shared builder", () => {
      const shared = buildProspectusHeader();
      expect(SAMPLE_PROSPECTUS_PAGE_TWO.header).toMatchObject({
        brandName: shared.brandName,
        tagline: shared.tagline,
        shariahStatusBadge: shared.shariahStatusBadge,
      });
      expect(SAMPLE_PROSPECTUS_PAGE_THREE.header).toMatchObject({
        brandName: shared.brandName,
        tagline: shared.tagline,
        shariahStatusBadge: shared.shariahStatusBadge,
      });
      expect(shared.shariahStatusBadge).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    });

    it("Page 2 and Page 3 HTML use shared header module with Shariah badge", () => {
      const pageTwoHtml = renderProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
      const pageThreeHtml = renderProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
      for (const html of [pageTwoHtml, pageThreeHtml]) {
        expect(html).toContain("Shariah Status Badge:");
        expect(html).toContain('class="shariah-badge"');
        expect(html).toContain("Brand Tagline:");
        expect(html).not.toContain("source-statement");
        expect(html).not.toContain('data-stage="footer"');
        expect(html).not.toContain("prospectus-footer");
      }
      expect(pageTwoHtml).not.toContain("Company Name:");
      expect(pageTwoHtml).not.toContain("Registration Number:");
      expect(pageThreeHtml).not.toContain("Issuer:");

      const pageTwoSource = readFileSync(
        join(__dirname, "prospectus-page-two.html.ts"),
        "utf8"
      );
      expect(pageTwoSource).toContain("buildProspectusHeaderHtml");
      expect(pageTwoSource).not.toMatch(/function renderHeader/);
    });
  });
});

