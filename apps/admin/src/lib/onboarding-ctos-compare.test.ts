import type { OnboardingApplicationResponse } from "@cashsouk/types";
import {
  buildOnboardingCtosComparison,
  buildSharePctMapFromCorporateEntities,
  ctosResolvedSharePctPercent,
  lookupSharePctForAppRow,
} from "./onboarding-ctos-compare";

function application(overrides: Partial<OnboardingApplicationResponse> = {}): OnboardingApplicationResponse {
  return {
    id: "app-1",
    userId: "u",
    userName: "n",
    userEmail: "e@test.com",
    type: "COMPANY",
    portal: "issuer",
    organizationId: "org-1",
    organizationName: "ABC SDN BHD",
    registrationNumber: "202001234567",
    regtankRequestId: null,
    regtankStatus: null,
    regtankSubstatus: null,
    regtankPortalUrl: null,
    kycPortalUrl: null,
    kybPortalUrl: null,
    onboardingStatus: "PENDING_SSM_REVIEW",
    status: "PENDING_SSM_REVIEW",
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
    corporateEntities: {
      directors: [
        {
          personalInfo: {
            fullName: "Jamie",
            formContent: {
              content: [{ fieldName: "Government ID Number", fieldValue: "800101011234" }],
            },
          },
        },
        {
          personalInfo: {
            fullName: "Bob",
            formContent: {
              content: [{ fieldName: "Government ID Number", fieldValue: "900101101234" }],
            },
          },
        },
      ],
      shareholders: [
        {
          personalInfo: {
            fullName: "Ali",
            formContent: {
              content: [
                { fieldName: "Government ID Number", fieldValue: "850101011111" },
                { fieldName: "% of Shares", fieldValue: "20" },
              ],
            },
          },
        },
      ],
      corporateShareholders: [
        {
          businessName: "ABC Berhad",
          formContent: {
            displayAreas: [
              {
                displayArea: "Basic Information Setting",
                content: [
                  { fieldName: "Business Name", fieldValue: "ABC Berhad" },
                  { fieldName: "Business Number", fieldValue: "202001234567" },
                  { fieldName: "% of Shares", fieldValue: "30" },
                ],
              },
            ],
          },
        },
      ],
    },
    ...overrides,
  } as OnboardingApplicationResponse;
}

describe("buildOnboardingCtosComparison", () => {
  const ctosJson = {
    name: "ABC SDN BHD",
    brn_ssm: "123456-A",
    directors: [
      { party_type: "I", nic_brno: "800101011234", name: "Jamie", position: "DO" },
      {
        party_type: "I",
        nic_brno: "850101011111",
        name: "Ali",
        position: "SO",
        equity_percentage: 25,
      },
      {
        party_type: "C",
        ic_lcno: "123456-A",
        brn_ssm: "123456-A",
        name: "ABC Berhad",
        position: "SO",
        equity_percentage: 30,
      },
    ],
  };

  it("keeps RegTank % on the application side and CTOS % on the CTOS side after a match", () => {
    const compare = buildOnboardingCtosComparison(application(), ctosJson, "ready");
    const ali = compare.shareholders.matched.find((row) => row.app.name === "Ali");
    expect(ali).toBeDefined();
    const sharePctById = buildSharePctMapFromCorporateEntities(application().corporateEntities);
    expect(lookupSharePctForAppRow(ali!.app, sharePctById)).toBe(20);
    expect(ctosResolvedSharePctPercent(ali!.ctos)).toBe(25);
  });

  it("keeps old SSM and new SSM as separate rows when they do not share an ID", () => {
    const compare = buildOnboardingCtosComparison(application(), ctosJson, "ready");
    expect(compare.shareholders.onlyApplication.some((row) => row.name === "ABC Berhad")).toBe(true);
    expect(compare.shareholders.onlyCtos.some((row) => row.name === "ABC Berhad")).toBe(true);
    expect(compare.shareholders.matched.some((row) => row.app.name === "ABC Berhad")).toBe(false);
  });

  it("includes corporate shareholders from company_json.directors with party_type C", () => {
    const compare = buildOnboardingCtosComparison(application(), ctosJson, "ready");
    expect(compare.shareholders.onlyCtos.some((row) => row.party_type === "C")).toBe(true);
    expect(compare.directors.onlyApplication.some((row) => row.name === "Bob")).toBe(true);
    expect(compare.directors.matched.some((row) => row.app.name === "Jamie")).toBe(true);
  });
});
