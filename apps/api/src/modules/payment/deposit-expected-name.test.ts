import { OrganizationType } from "@prisma/client";
import {
  resolveInvestorExpectedName,
  resolveInvestorExpectedNameVariants,
} from "./deposit-service";

describe("resolveInvestorExpectedNameVariants (company)", () => {
  it("uses onboarding businessName when present", () => {
    const org = {
      type: OrganizationType.COMPANY,
      name: "Org Name Fallback Sdn Bhd",
      corporate_onboarding_data: { basicInfo: { businessName: "Onboarding Business Sdn Bhd" } },
      legal_name_on_id: null,
      first_name: null,
      middle_name: null,
      last_name: null,
    } as never;

    expect(resolveInvestorExpectedNameVariants(org)).toEqual(["Onboarding Business Sdn Bhd"]);
    expect(resolveInvestorExpectedName(org)).toBe("Onboarding Business Sdn Bhd");
  });

  it("returns no company name when businessName is missing even if org.name is present", () => {
    const org = {
      type: OrganizationType.COMPANY,
      name: "Malcan Ventures Sdn Bhd",
      corporate_onboarding_data: { basicInfo: {} },
      legal_name_on_id: null,
      first_name: null,
      middle_name: null,
      last_name: null,
    } as never;

    expect(resolveInvestorExpectedNameVariants(org)).toEqual([]);
    expect(resolveInvestorExpectedName(org)).toBeNull();
  });
});

describe("resolveInvestorExpectedNameVariants (personal)", () => {
  it("keeps personal investor behaviour unchanged", () => {
    const org = {
      type: OrganizationType.PERSONAL,
      name: "Display Name",
      corporate_onboarding_data: null,
      legal_name_on_id: "Ali Bin Abu",
      first_name: "Ali",
      middle_name: null,
      last_name: "Abu",
    } as never;

    expect(resolveInvestorExpectedNameVariants(org)).toEqual([
      "Ali Bin Abu",
      "Ali Abu",
      "Display Name",
    ]);
    expect(resolveInvestorExpectedName(org)).toBe("Ali Bin Abu");
  });
});
