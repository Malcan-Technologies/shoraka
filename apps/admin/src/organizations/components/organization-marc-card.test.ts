import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(__dirname, "organization-marc-card.tsx"), "utf8");
const prospectusSummary = fs.readFileSync(
  path.join(__dirname, "../../notes/prospectus-review/marc-assessment-summary.tsx"),
  "utf8"
);
const invoiceOffer = fs.readFileSync(
  path.join(__dirname, "../../components/invoice-offer-panel.tsx"),
  "utf8"
);

describe("organization MARC credit assessment card", () => {
  it("derives Credit Grade from Credit Score and does not expose a grade dropdown", () => {
    expect(source).toContain("marcSmeGradeFromCreditScore");
    expect(source).toContain("MARC_CREDIT_GRADE_FROM_SCORE_HELP");
    expect(source).toContain("Credit Score");
    expect(source).toContain("Credit Grade");
    expect(source).toContain("Probability of Default");
    expect(source).toContain("MARC Report");
    expect(source).toContain("Report Date");
    expect(source).toContain("Save MARC Assessment");
    expect(source).toContain("requestIssuerMarcReportUploadUrl");
    expect(source).not.toContain("Select SME grade");
    expect(source).not.toContain("MARC_SME_GRADES");
    expect(source).not.toContain("<Select");
    expect(source).not.toContain("SoukScore");
    expect(source).not.toContain("CashSouk Intelligence");
  });

  it("keeps PD as an independent ops input", () => {
    expect(source).toContain("parseMarcProbabilityOfDefault");
    expect(source).not.toContain("marcOfficialPd(");
    expect(source).not.toContain("setProbabilityOfDefault(marcOfficialPd");
  });

  it("does not add MARC score or PD editors to invoice offer or Prospectus Review", () => {
    expect(invoiceOffer).not.toContain("createIssuerMarcAssessment");
    expect(invoiceOffer).not.toContain("Credit Score");
    expect(invoiceOffer).toContain("riskRating");
    expect(prospectusSummary).toContain("ProspectusReadOnlyField");
    expect(prospectusSummary).not.toContain("parseMarcCreditScore");
    expect(prospectusSummary).not.toContain("<Input");
  });
});
