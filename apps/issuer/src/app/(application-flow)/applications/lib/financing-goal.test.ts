import * as fs from "fs";
import * as path from "path";
import {
  buildFinancingJourneySummary,
  isRequestedFacilityAtOrAboveContractValue,
  listFinancingGoalChoices,
  NO_APPROVED_FACILITY_COPY,
  OPENING_APPLICATION_COPY,
  resolveInitialFinancingGoal,
} from "@cashsouk/types";
import { goalRadioTabIndex, resolveGoalRadioTabStopId } from "./financing-goal-a11y";

describe("issuer financing goal model", () => {
  it("offers three goal-based choices and never exposes internal labels", () => {
    const choices = listFinancingGoalChoices({ hasApprovedFacilities: true });
    expect(choices).toHaveLength(3);
    expect(choices.map((choice) => `${choice.title} ${choice.description}`).join(" ")).not.toMatch(
      /new_contract|existing_contract|invoice_only/
    );
    expect(choices.map((choice) => choice.title)).toEqual([
      "Set up a new facility",
      "Finance an invoice from an approved facility",
      "Finance one invoice without a facility",
    ]);
  });

  it("keeps the approved-facility choice visible and disabled when none exist", () => {
    const existing = listFinancingGoalChoices({ hasApprovedFacilities: false }).find(
      (choice) => choice.id === "existing_contract"
    );
    expect(existing?.disabled).toBe(true);
    expect(existing?.disabledReason).toBe(NO_APPROVED_FACILITY_COPY);
  });

  it("prefills the approved-facility journey from a facility Finance an invoice entry", () => {
    expect(resolveInitialFinancingGoal({ prefillFacilityId: "con_1" })).toEqual({
      structureType: "existing_contract",
      facilityId: "con_1",
      fromPrefill: true,
    });
  });

  it("builds a journey summary that explains what happens now and after submission", () => {
    const summary = buildFinancingJourneySummary("new_contract");
    expect(summary?.title).toBe("Your journey");
    expect(summary?.after).toMatch(/Finance an invoice/);
  });

  it("treats requested financing at or above contract face as invalid", () => {
    expect(isRequestedFacilityAtOrAboveContractValue(250_000, 250_000)).toBe(true);
    expect(isRequestedFacilityAtOrAboveContractValue(249_999, 250_000)).toBe(false);
  });

  it("introduces the opening product screen without inventing catalog filters", () => {
    expect(OPENING_APPLICATION_COPY.title).toBe("What would you like to do?");
    expect(OPENING_APPLICATION_COPY.productListHeading).toMatch(/product/i);
  });

  it("keeps the selected enabled goal as the only radio tab stop", () => {
    expect(goalRadioTabIndex({ isTabStop: true, disabled: false })).toBe(0);
    expect(goalRadioTabIndex({ isTabStop: false, disabled: false })).toBe(-1);
    expect(goalRadioTabIndex({ isTabStop: true, disabled: true })).toBe(-1);
    expect(resolveGoalRadioTabStopId("existing_contract", ["new_contract", "invoice_only"])).toBe(
      "new_contract"
    );
    expect(
      resolveGoalRadioTabStopId("existing_contract", ["new_contract", "existing_contract"])
    ).toBe("existing_contract");
  });

  it("renders the facility selector and no-facility action outside the radio cards", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../steps/financing-structure-step.tsx"),
      "utf8"
    );
    expect(source).toContain('selectionRole="radio"');
    expect(source).toContain("goalRadioTabIndex");
    expect(source).toMatch(
      /<SelectionCard[\s\S]*?selectionRole="radio"[\s\S]*?\/>\s*\{isExisting && choice.disabled/
    );
    expect(source).toContain("<Select");
    expect(source).toContain("<Button");
  });

  it("places the journey above the goal options as informational copy", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../steps/financing-structure-step.tsx"),
      "utf8"
    );
    expect(source.indexOf("<FinancingJourneyPanel")).toBeGreaterThan(-1);
    expect(source.indexOf("<FinancingJourneyPanel")).toBeLessThan(
      source.indexOf('role="radiogroup"')
    );
    expect(source).toContain("bg-status-submitted-bg");
    expect(source).toContain("text-status-submitted-text");
  });

  it("assigns a distinct icon to each financing goal", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../steps/financing-structure-step.tsx"),
      "utf8"
    );
    expect(source).toContain("BuildingLibraryIcon");
    expect(source).toContain("BanknotesIcon");
    expect(source).toContain("DocumentTextIcon");
    expect(source).toContain("GoalLeadingIcon");
  });
});
