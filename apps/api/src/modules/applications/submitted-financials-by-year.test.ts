import { readFileSync } from "fs";
import { join } from "path";
import { APPLICATION_COMREP_DETAIL_KEYS, APPLICATION_CORE_MONEY_KEYS } from "@cashsouk/types";

const source = readFileSync(join(__dirname, "submitted-financials-by-year.ts"), "utf8");
const parser = readFileSync(join(__dirname, "../ctos/parser.ts"), "utf8");
const sixMonth = readFileSync(
  join(__dirname, "../../../../../packages/types/src/financial-unaudited-ctos-validation.ts"),
  "utf8"
);

describe("loadIssuerSubmittedFinancialYears", () => {
  it("reads org-scoped application revisions only and indexes them per FY", () => {
    expect(source).toContain("export async function loadIssuerSubmittedFinancialYears");
    expect(source).toContain("prisma.applicationRevision.findMany");
    expect(source).toContain(
      "where: { application: { issuer_organization_id: issuerOrganizationId } }"
    );
    expect(source).toContain("indexIssuerSubmittedFinancialYears");
    for (const column of [
      "id: true",
      "application_id: true",
      "review_cycle: true",
      "submitted_at: true",
      "snapshot: true",
    ]) {
      expect(source).toContain(column);
    }
    expect(source).not.toContain("prisma.application.findMany");
    expect(source).not.toContain("updated_at:");
    expect(source).not.toContain("status:");
    expect(source).not.toContain("financial_statements: true");
    expect(source).not.toContain("issuerOrganizationFinancialStatement");
    expect(source).not.toContain("ctosReport");
  });

  it("does not change the CTOS parser or 6-month tab helper", () => {
    for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
      expect(parser).not.toContain(key);
    }
    expect(sixMonth).toContain("export function getIssuerFinancialTabYears");
    expect(sixMonth).toContain("addMonths(previousFYEnd, 6)");
    expect([...APPLICATION_CORE_MONEY_KEYS]).toContain("curlib");
    expect([...APPLICATION_CORE_MONEY_KEYS]).not.toContain("curlib_borrowing");
  });
});
