import type { OnboardingApplicationResponse } from "@cashsouk/types";
import { buildUnifiedCtosDirectorShareholdersFromCompanyJson } from "@cashsouk/types";
import { buildOnboardingCtosComparison } from "../../admin/src/lib/onboarding-ctos-compare";

/**
 * Onboarding extract must map ic_no → ic_lcno like display so merge keys match
 * when raw rows have ic_no only (see director-shareholder-display extract).
 */
describe("onboarding CTOS extract ic_no ↔ ic_lcno alignment with display merge", () => {
  const companyJson = {
    directors: [
      {
        party_type: "I",
        name: "First Name Variant",
        nic_brno: null,
        ic_lcno: null,
        ic_no: "S123-4567-A",
        position: "DO",
        equity_percentage: 0,
        equity: 0,
      },
      {
        party_type: "I",
        name: "Second Name Variant",
        nic_brno: null,
        ic_lcno: null,
        ic_no: "S123-4567-A",
        position: "DO",
        equity_percentage: 0,
        equity: 0,
      },
    ],
  };

  const minimalApplication = {
    id: "app-1",
    userId: "u",
    userName: "n",
    userEmail: "e@test.com",
    type: "COMPANY" as const,
    portal: "issuer" as const,
    organizationId: "org-1",
    organizationName: "Test Co",
    registrationNumber: "REG",
    regtankRequestId: null,
    regtankStatus: null,
    regtankSubstatus: null,
    regtankPortalUrl: null,
    kycPortalUrl: null,
    kybPortalUrl: null,
    onboardingStatus: "PENDING_SSM_REVIEW" as const,
    status: "PENDING_SSM_REVIEW" as const,
    ssmVerified: false,
    ssmVerifiedAt: null,
    ssmVerifiedBy: null,
    submittedAt: null,
    completedAt: null,
    onboardingApproved: false,
    amlApproved: false,
    tncAccepted: false,
    ssmApproved: false,
    isCompleted: false,
  } as OnboardingApplicationResponse;

  it("produces one verification merge group and matches display unified list (same IC key)", () => {
    const unified = buildUnifiedCtosDirectorShareholdersFromCompanyJson(companyJson);
    expect(unified).toHaveLength(1);
    expect(unified[0].ic.replace(/\W/g, "").toUpperCase()).toBe("S1234567A");

    const compare = buildOnboardingCtosComparison(minimalApplication, companyJson, "ready");
    expect(compare.directors.onlyCtos).toHaveLength(1);
    const ctosRow = compare.directors.onlyCtos[0];
    expect(String(ctosRow.ic_lcno ?? "").replace(/\W/g, "").toUpperCase()).toBe("S1234567A");
  });
});
