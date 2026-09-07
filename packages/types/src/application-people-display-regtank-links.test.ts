import {
  getRegtankCorporateOnboardingUrl,
  getRegtankCorporatePersonOnboardingUrl,
  getRegtankLivenessUrl,
  getRegtankOnboardingViewLinks,
  getRegtankScreeningLink,
} from "./application-people-display";

describe("RegTank portal URL helpers", () => {
  const previous = process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL = "https://shoraka-trial.regtank.com";
  });

  afterAll(() => {
    if (previous == null) delete process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL;
    else process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL = previous;
  });

  it("builds company COD URL", () => {
    expect(getRegtankCorporateOnboardingUrl("COD05463")).toBe(
      "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05463?archived=false"
    );
  });

  it("builds related-party nested COD/EOD URL", () => {
    expect(getRegtankCorporatePersonOnboardingUrl("COD05463", "EOD01234")).toBe(
      "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05463/EOD01234"
    );
  });

  it("builds personal liveness URL", () => {
    expect(getRegtankLivenessUrl("LD001")).toBe(
      "https://shoraka-trial.regtank.com/app/liveness/LD001?archived=false"
    );
    expect(getRegtankLivenessUrl("EOD999")).toBe(
      "https://shoraka-trial.regtank.com/app/liveness/EOD999?archived=false"
    );
  });

  it("builds KYC URL without /scoring", () => {
    expect(getRegtankScreeningLink({ screeningRequestId: "KYC1", requestId: "KYC1", screening: null })).toBe(
      "https://shoraka-trial.regtank.com/app/screen-kyc/result/KYC1"
    );
  });

  it("builds KYB URL with riskAssessment only when risk is present", () => {
    expect(getRegtankScreeningLink({ screeningRequestId: "KYB1", requestId: "KYB1", screening: null })).toBe(
      "https://shoraka-trial.regtank.com/app/screen-kyb/result/KYB1"
    );
    expect(
      getRegtankScreeningLink({
        screeningRequestId: "KYB1",
        requestId: "KYB1",
        screening: { riskLevel: "HIGH" },
      })
    ).toBe("https://shoraka-trial.regtank.com/app/screen-kyb/result/KYB1/riskAssessment");
  });

  it("does not use a KYC id as the people-table onboarding View URL", () => {
    const links = getRegtankOnboardingViewLinks({
      entityType: "INDIVIDUAL",
      parentCorporateRequestId: "COD05463",
      directorEodRequestId: "EOD01234",
      shareholderEodRequestId: null,
      partyCorporateRequestId: null,
    });
    expect(links).toEqual([
      {
        label: "View",
        requestId: "EOD01234",
        url: "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05463/EOD01234",
      },
    ]);
  });
});
