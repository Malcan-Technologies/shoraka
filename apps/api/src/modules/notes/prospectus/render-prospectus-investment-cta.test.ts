import { readFileSync } from "fs";
import path from "path";
import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import { buildProspectusFooter } from "./prospectus-footer";
import { buildProspectusHeader } from "./prospectus-header";
import {
  PROSPECTUS_BRAND_NAME,
  PROSPECTUS_DATA_NOT_AVAILABLE as HEADER_DNA,
  PROSPECTUS_OFFICIAL_LOGO_REPO_PATH,
} from "./prospectus-header.types";
import { buildProspectusInvestmentCta } from "./prospectus-investment-cta";
import {
  SAMPLE_PROSPECTUS_FOOTER,
  SAMPLE_PROSPECTUS_HEADER,
  SAMPLE_PROSPECTUS_INVESTMENT_CTA,
  SAMPLE_PROSPECTUS_INVESTMENT_CTA_INPUT,
  SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID,
} from "./prospectus-investment-cta.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL,
  PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES,
  PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
} from "./prospectus-investment-cta.types";
import { buildProspectusInvestorNoteInvestmentPath } from "./prospectus-investor-note-route";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import { buildProspectusInvestmentCtaDocument } from "./render-prospectus-investment-cta";

describe("prospectus Page 2 CTA and shared header/footer (DATA STAGE 8)", () => {
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
      expect(header.shariahStatusBadge).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(header.audit.shariahBadge.productNameInferenceAllowed).toBe(false);
      expect(header.audit.shariahBadge.generatedClaimAllowed).toBe(false);
      expect(header.shariahStatusBadge).not.toMatch(/Shariah Compliant/i);
      expect(header.shariahStatusBadge).not.toMatch(/Shariah Approved/i);
    });
  });

  describe("CTA", () => {
    it("uses static heading and button label with DNA paragraph", () => {
      const cta = buildProspectusInvestmentCta(SAMPLE_PROSPECTUS_INVESTMENT_CTA_INPUT);
      expect(cta.sectionHeading).toBe("INVEST WITH CONFIDENCE");
      expect(cta.sectionHeading).toBe(PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING);
      expect(cta.buttonLabel).toBe("INVEST NOW");
      expect(cta.buttonLabel).toBe(PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL);
      expect(cta.paragraph).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(cta.audit.paragraph.generatedMarketingClaimAllowed).toBe(false);
    });

    it("does not generate attractive, short-term, or Shariah-compliant investment claims", () => {
      const cta = buildProspectusInvestmentCta({
        marketingParagraph:
          "attractive return short-term Shariah-compliant investment earn with purpose",
      });
      expect(cta.paragraph).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(cta.paragraph).not.toMatch(/attractive return/i);
      expect(cta.paragraph).not.toMatch(/short-term/i);
      expect(cta.paragraph).not.toMatch(/Shariah-compliant/i);
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

    it("builds the confirmed investor Note route from note id", () => {
      const expected = `/investments/${SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID}`;
      expect(
        buildProspectusInvestorNoteInvestmentPath(SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID)
      ).toBe(expected);

      const cta = buildProspectusInvestmentCta({
        noteId: SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID,
      });
      expect(cta.buttonHref).toBe(expected);
      expect(cta.isButtonEnabled).toBe(true);
      expect(cta.audit.button.destinationRouteSource).toBe("confirmed_existing_route");
      expect(cta.audit.button.investabilityRuleOwnedByMarketplace).toBe(true);
      expect(PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES.buttonHref.canonicalSource).toBe(
        "/investments/{notes.id}"
      );
    });

    it("disables CTA when destination is missing and rejects unsafe URLs", () => {
      const missing = buildProspectusInvestmentCta({});
      expect(missing.buttonHref).toBeNull();
      expect(missing.isButtonEnabled).toBe(false);
      expect(missing.audit.button.destinationRouteSource).toBe("unavailable");

      for (const bad of [
        "#",
        "javascript:alert(1)",
        "https://evil.example/investments/abc",
        "data:text/html,hi",
        "/marketplace/abc",
        "/investments/../admin",
        "note-id",
      ]) {
        const cta = buildProspectusInvestmentCta({
          noteId: bad.startsWith("/investments/") ? null : bad.length < 8 ? bad : null,
          investmentDestinationUrl: bad,
        });
        expect(cta.buttonHref).toBeNull();
        expect(cta.isButtonEnabled).toBe(false);
      }

      const html = buildProspectusInvestmentCtaDocument({
        cta: missing,
      });
      expect(html).toContain('disabled aria-disabled="true"');
      expect(html).not.toContain('href="#"');
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain("<a ");
    });

    it("does not display the raw Note id as visible text", () => {
      const html = buildProspectusInvestmentCtaDocument({
        cta: SAMPLE_PROSPECTUS_INVESTMENT_CTA,
      });
      expect(html).toContain(
        `href="/investments/${SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID}"`
      );
      expect(html).not.toContain(`Note ID: ${SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID}`);
      expect(html).not.toContain(`noteId=${SAMPLE_PROSPECTUS_INVESTMENT_CTA_NOTE_ID}`);
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
    });
  });

  describe("footer", () => {
    it("keeps legal fields DNA when only Canva/legacy wording is supplied", () => {
      const footer = buildProspectusFooter({
        legacyCanvaRiskWarning:
          "Investments are subject to credit risk, default risk, and other risks.",
        legacyCanvaTermsStatement:
          "Investors are advised to read and understand the Product Terms and Risk Disclosure Statement before investing.",
      });
      expect(footer.investmentRiskWarning).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(footer.productTermsRiskDisclosureStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(footer.audit.riskWarning.status).toBe("unresolved");
      expect(footer.audit.termsStatement.status).toBe("unresolved");
      expect(footer.audit.riskWarning.generatedLegalCopyAllowed).toBe(false);
      expect(footer.audit.termsStatement.generatedLegalCopyAllowed).toBe(false);
      expect(footer.audit.shared.reusableAcrossProspectusPages).toBe(true);

      expect(footer.investmentRiskWarning).not.toMatch(/credit risk/i);
      expect(footer.productTermsRiskDisclosureStatement).not.toMatch(
        /Product Terms and Risk Disclosure Statement before investing/i
      );
    });
  });

  describe("shared HTML composition", () => {
    it("renders reusable header → CTA → footer without audit or debug fields", () => {
      const html = buildProspectusInvestmentCtaDocument({
        header: SAMPLE_PROSPECTUS_HEADER,
        cta: SAMPLE_PROSPECTUS_INVESTMENT_CTA,
        footer: SAMPLE_PROSPECTUS_FOOTER,
      });

      const headerIdx = html.indexOf('class="prospectus-header"');
      const ctaIdx = html.indexOf('class="prospectus-investment-cta"');
      const footerIdx = html.indexOf('class="prospectus-footer"');
      expect(headerIdx).toBeGreaterThan(-1);
      expect(ctaIdx).toBeGreaterThan(headerIdx);
      expect(footerIdx).toBeGreaterThan(ctaIdx);

      expect(html).toContain("CashSouk");
      expect(html).toContain("Brand Tagline: Data not available");
      expect(html).toContain("Shariah Status Badge: Data not available");
      expect(html).toContain("INVEST WITH CONFIDENCE");
      expect(html).toContain("CTA Paragraph: Data not available");
      expect(html).toContain("INVEST NOW");
      expect(html).toContain("Minimum investment: RM 100.00");
      expect(html).toContain("Investment Risk Warning: Data not available");
      expect(html).toContain(
        "Product Terms / Risk Disclosure Statement: Data not available"
      );

      expect(html).not.toContain("logoSource");
      expect(html).not.toContain("taglineApproved");
      expect(html).not.toContain("destinationRouteSource");
      expect(html).not.toContain("generatedLegalCopyAllowed");
      expect(html).not.toContain("approvedLegalCopyVersionDecision");
      expect(html).not.toContain("apps/investor/public/logo.svg");
      expect(html).not.toContain('"audit"');
      expect(html).not.toContain("route debug");
      expect(html).not.toContain("investabilityRuleOwnedByMarketplace");
    });
  });
});
