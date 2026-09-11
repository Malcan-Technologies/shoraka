import {
  FINANCIAL_FIELD_LABELS,
  ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ISSUER_PROFILE_PNL_KEYS,
} from "./financial-field-labels";
import {
  PROFILE_ADDRESS_FIELD_LABELS,
  PROFILE_LABEL,
  PROFILE_REQUIRED_EMPTY_LABEL,
  formatProfileRmAmount,
  profileAddressCompletenessLabel,
  profileFinancialFieldLabel,
} from "./profile-field-copy";
import { SC_MONTHLY_ISSUER_FINANCIAL_LABELS } from "./comrep-field-copy";
import { isIssuerFinancialFieldRequired, ISSUER_OPTIONAL_FINANCIAL_KEYS } from "./comrep-requiredness";

describe("Profile field copy", () => {
  it("keeps Profile financial labels free of pipe and backend wording", () => {
    for (const key of [...ISSUER_PROFILE_BALANCE_SHEET_KEYS, ...ISSUER_PROFILE_PNL_KEYS]) {
      const label = FINANCIAL_FIELD_LABELS[key];
      expect(label).toBeTruthy();
      expect(label).not.toContain("|");
      expect(label).not.toContain("_");
      expect(profileFinancialFieldLabel(key, true)).toBe(`${label} (RM)`);
    }
  });

  it("keeps SC mapping labels on ComRep financial keys without using them as Profile copy", () => {
    expect(SC_MONTHLY_ISSUER_FINANCIAL_LABELS.bscatot).toBe("Assets|Current (RM)");
    expect(FINANCIAL_FIELD_LABELS.bscatot).toBe("Current Assets");
    expect(FINANCIAL_FIELD_LABELS.bsclbank).toBe("Non-current Assets");
    expect(FINANCIAL_FIELD_LABELS.bsqpuc).toBe("Share Capital");
  });

  it("marks only the current optional issuer financial keys as Optional", () => {
    expect([...ISSUER_OPTIONAL_FINANCIAL_KEYS].sort()).toEqual(
      ["equity_minority", "equity_share_application", "equity_share_premium"].sort()
    );
    expect(isIssuerFinancialFieldRequired("bscatot")).toBe(true);
    expect(isIssuerFinancialFieldRequired("equity_share_application")).toBe(false);
    expect(isIssuerFinancialFieldRequired("pl_minority")).toBe(true);
  });

  it("uses section-prefixed completeness labels for addresses", () => {
    expect(profileAddressCompletenessLabel("registered", "line1")).toBe("Registered Address");
    expect(profileAddressCompletenessLabel("registered", "state")).toBe("Registered Address (State)");
    expect(profileAddressCompletenessLabel("business", "postcode")).toBe("Business Address (Postcode)");
  });

  it("formats RM amounts for read mode without persisting a dash", () => {
    expect(formatProfileRmAmount(5000)).toBe("RM 5,000");
    expect(formatProfileRmAmount("")).toBe("—");
    expect(formatProfileRmAmount(null)).toBe("—");
  });

  it("uses canonical Profile labels for identity and contact", () => {
    expect(PROFILE_LABEL.companyRegistrationNumber).toBe("Company Registration Number");
    expect(PROFILE_LABEL.personEmail).toBe("Person Email");
    expect(PROFILE_LABEL.accountEmail).toBe("Account Email");
    expect(PROFILE_LABEL.companyActivities).toBe("Company Activities");
    expect(PROFILE_LABEL.mainCustomers).toBe("Who are your main customers?");
    expect(PROFILE_ADDRESS_FIELD_LABELS.state).toBe("State");
    expect(PROFILE_ADDRESS_FIELD_LABELS.postcode).toBe("Postcode");
    expect(PROFILE_REQUIRED_EMPTY_LABEL).toBe("Please fill up");
  });
});
