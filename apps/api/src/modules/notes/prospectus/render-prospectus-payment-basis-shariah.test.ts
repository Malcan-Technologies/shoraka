import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES,
} from "./prospectus-payment-basis-shariah.types";
import { buildProspectusPaymentBasisShariahDocument } from "./render-prospectus-payment-basis-shariah";

describe("prospectus Payment Basis and Shariah Principle (Page 1 DATA STAGE 4C)", () => {
  it("documents both fields as unresolved with no confirmed source", () => {
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.paymentBasis.canonicalSource).toBe(
      "none confirmed"
    );
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.shariahPrinciple.canonicalSource).toBe(
      "none confirmed"
    );
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.paymentBasis.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.shariahPrinciple.availability).toBe(
      "unresolved"
    );
  });

  it("always returns Data not available (does not invent Canva or Tawarruq labels)", () => {
    const data = buildProspectusPaymentBasisShariah({});
    expect(data.paymentBasis).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.shariahPrinciple).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymentBasis).not.toContain("Bullet");
    expect(data.shariahPrinciple).not.toMatch(/Bai|Tawarruq|Murabahah/i);
  });

  it("renders plain HTML with Stage 4C lines", () => {
    const html = buildProspectusPaymentBasisShariahDocument();
    expect(html).toContain("Payment basis: Data not available");
    expect(html).toContain("Shariah principle: Data not available");
    expect(html).toContain("none confirmed");
    expect(html).not.toContain("Bullet Payment at Maturity");
    expect(html).not.toContain("Bai");
  });
});
