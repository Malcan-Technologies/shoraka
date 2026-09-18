import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "financial-statements-step.tsx"), "utf8");
const editPageSource = readFileSync(join(__dirname, "../[id]/edit/page.tsx"), "utf8");

const EXISTING_APPLICATION_FIELDS = [
  "pldd",
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "curlib",
  "bsslltd",
  "bsclstd",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
] as const;

const COMREP_ONLY_FIELDS = [
  "curlib_borrowing",
  "curlib_non_borrowing",
  "ncl_loan",
  "ncl_non_loan",
  "equity_share_application",
  "equity_share_premium",
  "equity_accumulated_profit",
  "equity_minority",
  "operating_cost",
  "admin_cost",
  "interest_cost",
  "other_cost",
  "pl_minority",
] as const;

describe("issuer application Financial Statements step", () => {
  it("keeps every existing application financial field", () => {
    for (const key of EXISTING_APPLICATION_FIELDS) {
      expect(source).toContain(`${key}:`);
      expect(source).toContain(`"${key}"`);
    }
    expect(source).toContain("YEAR_MONEY_FIELDS");
    expect(source).toContain("[...APPLICATION_CORE_MONEY_KEYS]");
  });

  it("adds ComRep-only fields in a separate Additional Financial Details section", () => {
    expect(source).toContain("Additional Financial Details");
    expect(source).toContain("(optional)");
    expect(source).toContain("For regulatory reporting. Filling this in may strengthen your application.");
    expect(source.indexOf("Profit and Loss")).toBeLessThan(source.indexOf("Additional Financial Details"));
    for (const key of COMREP_ONLY_FIELDS) {
      expect(source).toContain(`"${key}"`);
      expect(EXISTING_APPLICATION_FIELDS).not.toContain(key);
    }
    expect(source).toContain("APPLICATION_COMREP_OPTIONAL_KEYS");
  });

  it("does not use profile values as a year-amount prefill fallback", () => {
    expect(source).toContain("buildApplicationFinancialPrefillByYear");
    expect(source).toContain("year amounts are not copied from profile");
    expect(source).toContain("submittedByYear: prefillSubmittedByYear");
    expect(source).toContain(
      "Previous financial year auto-filled from company records or a previous financing"
    );
    expect(source).not.toContain("org_master");
    expect(source).not.toContain("autoPrefillMode");
    expect(source).toContain("fromSaved(resolved.fields)");
    expect(source).not.toContain("fromCtos");
  });

  it("renders stored years in readOnly without live FYE window validation", () => {
    expect(source).toContain("storedFinancialFormYears(savedStoredFormsByYear ?? formsByYear)");
    expect(source).toContain("if (readOnly) return;");
    expect(source).toContain("if (!isInitialized || readOnly) return false");
    expect(source).toContain("isFinancialYearEndDisplayDirtyAgainstSnapshot");
    expect(source).toContain("parseFinancialStatementsQuestionnaireShape({ financial_year_end: iso })");
    expect(source).toContain("const fyeWindow = readOnly ? null : getFinancialYearEndAllowedWindow(new Date())");
    expect(source).toContain("qNorm?.financial_year_end ?? qShape?.financial_year_end");
  });

  it("labels the picker as next FYE and clamps open-year periods to today", () => {
    expect(source).toContain("What is your company&apos;s next financial year end?");
    expect(source).toContain("Management accounts. This financial year has not closed");
    expect(source).toContain("clampEndTo: periodAsAt");
    expect(source).toContain("(as at today)");
    expect(source).toContain("Select your next financial year end above, then enter amounts here");
  });

  it("keeps editable year tabs independent of formsByYear identity", () => {
    expect(source).toContain(
      "const yearsToShow = readOnly || preserveStoredYears ? storedYearsToShow : liveYearsToShow"
    );
    expect(source).toContain("reuseUnchangedYearForms(prev, next)");
    expect(source).toContain("[questionnaireDto]");
  });

  it("keeps the stored FYE and year tabs when amendment does not change FYE", () => {
    expect(source).toContain("isAmendmentMode = false");
    expect(editPageSource).toContain("isAmendmentMode={isAmendmentModeEffective}");
    expect(source).toContain("applicationFlowDateToIso(fyeDateInput) === savedStoredFye");
    expect(source).toContain("restorePreservedStoredYearForms");
    expect(source).toContain("setSavedStoredFormsByYear");
    expect(source).toContain("buildV2ApiPayload(questionnaireDto, formsByYear, yearsToShow)");
    expect(source).toContain("preserveStoredYears || getApplicationFlowFinancialYearEndError");
  });

  it("seeds new-application org FYE only from the live window, not shape-only history", () => {
    expect(source).toContain("newApplicationOrgPrefillFinancialYearEnd(orgSaved.questionnaire)");
    expect(source).toContain("setPrefillCtos(latest?.ctos_financials ?? null)");
    expect(source).toContain("setPrefillSubmittedByYear(latest?.submitted_by_year ?? {})");
    expect(source).toContain("questionnaire: { financial_year_end: prefillFye }");
    const orgPrefillStart = source.indexOf("Org JSON may seed FYE only when it is still inside the live window");
    const orgPrefillEnd = source.indexOf("Financial step initialized (v2 saved / blank / auto-prefill attempted)");
    expect(orgPrefillStart).toBeGreaterThan(-1);
    expect(orgPrefillEnd).toBeGreaterThan(orgPrefillStart);
    const orgPrefillBlock = source.slice(orgPrefillStart, orgPrefillEnd);
    expect(orgPrefillBlock).not.toContain("parseFinancialStatementsQuestionnaireShape");
    expect(orgPrefillBlock).not.toContain("qNorm?.financial_year_end ?? qShape?.financial_year_end");
  });

  it("reports a general continue hint for the first incomplete required year", () => {
    expect(source).toContain("financialStatementsContinueHint");
    expect(source).toContain("saveHint: continueHint");
  });
});
