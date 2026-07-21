import { readFileSync } from "fs";
import path from "path";
import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import { buildProspectusHeader } from "./prospectus-header";
import {
  PROSPECTUS_BRAND_NAME,
  PROSPECTUS_DATA_NOT_AVAILABLE as HEADER_DNA,
  PROSPECTUS_OFFICIAL_LOGO_REPO_PATH,
} from "./prospectus-header.types";
import { buildProspectusInvestmentCta } from "./prospectus-investment-cta";
import {
  buildProspectusInvestmentCtaButtonHtml,
  buildProspectusInvestmentCtaHtml,
} from "./prospectus-investment-cta.html";
import {
  SAMPLE_PROSPECTUS_HEADER,
  SAMPLE_PROSPECTUS_INVESTMENT_CTA,
} from "./prospectus-investment-cta.sample-data";
import {
  PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL,
  PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES,
  PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
} from "./prospectus-investment-cta.types";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import { buildProspectusInvestmentCtaDocument } from "./render-prospectus-investment-cta";

describe("prospectus Page 2 CTA and shared header (DATA STAGE 8)", () => {
  describe("header", () => {
    it("uses the official logo asset and CashSouk brand name", () => {
      const header = buildProspectusHeader();
      expect(header.brandName).toBe("CashSouk");
      expect(header.brandName).toBe(PROSPECTUS_BRAND_NAME);
      expect(header.logo.kind).toBe("official_asset");
      if (header.logo.kind !== "official_asset") throw new Error("expected official logo");
      expect(header.logo.repoPath).toBe(PROSPECTUS_OFFICIAL_LOGO_REPO_PATH);
      expect(header.audit.brand.logoSource).toBe(PROSPECTUS_OFFICIAL_LOGO_REPO_PATH);

      const absoluteLogo = path.resolve(
        __dirname,
        "../../../../../investor/public/logo.svg"
      );
      expect(readFileSync(absoluteLogo, "utf8")).toContain("<svg");
    });

    it("keeps tagline DNA when only legacy/Canva tagline exists", () => {
      const header = buildProspectusHeader({
        legacyCanvaTagline: "Invest in Growth. Earn with Purpose.",
      });
      expect(header.tagline).toBe(HEADER_DNA);
      expect(header.audit.brand.taglineSource).toBe("unavailable");
      expect(header.audit.brand.taglineApproved).toBe(false);
    });

    it("keeps Shariah badge DNA and ignores -i / Tawarruq / Shoraka", () => {
      const header = buildProspectusHeader({
        productNameEndingInI: "Accounts Receivable Financing-i",
        tawarruqOrShorakaContext: { flow: "Tawarruq", product: "Shoraka" },
      });
      expect(header.shariahStatusBadge).toBe(HEADER_DNA);
      expect(header.audit.shariahBadge.productNameInferenceAllowed).toBe(false);
      expect(header.audit.shariahBadge.generatedClaimAllowed).toBe(false);
      expect(header.shariahStatusBadge).not.toMatch(/Shariah Compliant/i);
      expect(header.shariahStatusBadge).not.toMatch(/Shariah Approved/i);
    });
  });

  describe("CTA", () => {
    it("renders static heading, non-clickable button, and platform minimum", () => {
      const cta = buildProspectusInvestmentCta();
      expect(cta.sectionHeading).toBe("INVEST WITH CONFIDENCE");
      expect(cta.sectionHeading).toBe(PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING);
      expect(cta.buttonLabel).toBe("INVEST NOW");
      expect(cta.buttonLabel).toBe(PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL);
      expect(cta.buttonHref).toBeNull();
      expect(cta.minimumInvestmentStatement).toBe(
        `Minimum investment: ${formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR)}`
      );
      expect(cta).not.toHaveProperty("paragraph");
      expect(cta).not.toHaveProperty("isButtonEnabled");
      expect(cta.audit.staticOnly).toBe(true);
      expect(cta.audit.interactiveControlAllowed).toBe(false);
      expect(cta.audit.liveInvestabilityUsed).toBe(false);
      expect(cta.audit.routeInFrozenHtmlAllowed).toBe(false);
    });

    it("does not generate attractive, short-term, or Shariah-compliant investment claims", () => {
      const cta = buildProspectusInvestmentCta();
      expect(cta.audit.claims.attractiveReturnAllowed).toBe(false);
      expect(cta.audit.claims.shortTermClaimAllowed).toBe(false);
      expect(cta.audit.claims.shariahCompliantInvestmentClaimAllowed).toBe(false);

      const html = buildProspectusInvestmentCtaDocument({ cta });
      expect(html).not.toMatch(/attractive return/i);
      expect(html).not.toMatch(/short-term/i);
      expect(html).not.toMatch(/Shariah-compliant investment/i);
      expect(html).not.toMatch(/guaranteed return/i);
      expect(html).not.toMatch(/diversify your portfolio/i);
    });

    it("shows INVEST NOW as a disabled presentation button without a route", () => {
      const html = buildProspectusInvestmentCtaHtml(SAMPLE_PROSPECTUS_INVESTMENT_CTA);

      expect(html).toContain("INVEST WITH CONFIDENCE");
      expect(html).toContain("INVEST NOW");
      expect(html).toContain("Minimum investment: RM 100.00");
      expect(html).toContain('disabled aria-disabled="true"');
      expect(html).toContain('class="cta-button"');
      expect(html).not.toContain("CTA Paragraph");
      expect(html).not.toContain("Data not available");
      expect(html).not.toContain("<a ");
      expect(html).not.toContain('href="');
      expect(html).not.toContain("/investments/");
      expect(html).not.toContain("available amount");
      expect(html).not.toContain("acknowledge");
      expect(html).not.toContain("Product Terms");
      expect(html).not.toContain("Risk Disclosure");
      expect(html).not.toContain("QR");
    });

    it("can render a future href without changing the button helper contract", () => {
      const linked = buildProspectusInvestmentCtaButtonHtml({
        buttonLabel: "INVEST NOW",
        buttonHref: "/investments/futureNoteId001",
      });
      expect(linked).toContain('<a class="cta-button" href="/investments/futureNoteId001">');
      expect(linked).toContain("INVEST NOW");
      expect(linked).not.toContain("disabled");

      const frozen = buildProspectusInvestmentCtaButtonHtml({
        buttonLabel: "INVEST NOW",
        buttonHref: null,
      });
      expect(frozen).toContain("disabled");
      expect(frozen).not.toContain("<a ");
    });

    it("formats minimum investment from MARKETPLACE_MIN_COMMIT_MYR without hardcoding", () => {
      const cta = buildProspectusInvestmentCta();
      const money = formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR);
      expect(money).toBe("RM 100.00");
      expect(cta.minimumInvestmentStatement).toBe(`Minimum investment: ${money}`);
      expect(cta.audit.minimumInvestment.source).toBe("MARKETPLACE_MIN_COMMIT_MYR");
      expect(cta.audit.minimumInvestment.formatter).toBe("formatProspectusMoneyMyr");
      expect(cta.audit.minimumInvestment.capacityAdjustedMinimumUsed).toBe(false);

      const moduleSource = readFileSync(
        path.join(__dirname, "prospectus-investment-cta.ts"),
        "utf8"
      );
      expect(moduleSource).toContain("MARKETPLACE_MIN_COMMIT_MYR");
      expect(moduleSource).not.toMatch(/formatProspectusMoneyMyr\(\s*100\s*\)/);
      expect(moduleSource).not.toContain("Minimum investment: RM 100.00");
      expect(moduleSource).not.toContain("buildProspectusInvestorNoteInvestmentPath");
      expect(moduleSource).not.toContain("computeMarketplaceCommitBounds");
      expect(moduleSource).toContain("buttonHref: null");

      expect(
        PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES.minimumInvestmentStatement.canonicalSource
      ).toBe("MARKETPLACE_MIN_COMMIT_MYR");
      expect(PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES.buttonHref.availability).toBe("reserved");
    });
  });

  describe("shared HTML composition", () => {
    it("renders reusable header → static CTA without inventing investability", () => {
      const html = buildProspectusInvestmentCtaDocument({
        header: SAMPLE_PROSPECTUS_HEADER,
        cta: SAMPLE_PROSPECTUS_INVESTMENT_CTA,
      });

      const headerIdx = html.indexOf('class="page-header"');
      const ctaIdx = html.indexOf('class="prospectus-investment-cta"');
      expect(headerIdx).toBeGreaterThan(-1);
      expect(ctaIdx).toBeGreaterThan(headerIdx);
      expect(html).not.toContain("Source Note:");
      expect(html).not.toContain("Source: Data not available");

      expect(html).toContain("CashSouk");
      expect(html).toContain("Invest in Growth. Earn with Purpose.");
      expect(html).toContain("Shariah Compliant");
      expect(html).toContain("INVEST WITH CONFIDENCE");
      expect(html).toContain("INVEST NOW");
      expect(html).toContain("Minimum investment: RM 100.00");
      expect(html).toContain('disabled aria-disabled="true"');

      expect(html).not.toContain("logoSource");
      expect(html).not.toContain("taglineApproved");
      expect(html).not.toContain("destinationRouteSource");
      expect(html).not.toContain("apps/investor/public/logo.svg");
      expect(html).not.toContain('"audit"');
      expect(html).not.toContain("investabilityRuleOwnedByMarketplace");
    });
  });
});
