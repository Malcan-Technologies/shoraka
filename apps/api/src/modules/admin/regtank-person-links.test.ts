import {
  getRegtankColumnDisplayRows,
  getRegtankCorporateOnboardingUrl,
  getRegtankCorporatePersonOnboardingUrl,
  getRegtankLivenessUrl,
  getRegtankOnboardingViewLinks,
  getRegtankScreeningLink,
  type ApplicationPersonRow,
} from "@cashsouk/types";

const BASE = "https://shoraka-trial.regtank.com";

function person(overrides: Partial<ApplicationPersonRow>): ApplicationPersonRow {
  return {
    matchKey: "050616101789",
    name: "max chng",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    ...overrides,
  };
}

describe("RegTank person onboarding links", () => {
  it("builds COD + director EOD nested corporate URL", () => {
    const url = getRegtankCorporatePersonOnboardingUrl("COD05463", "EOD06803");
    expect(url).toBe(`${BASE}/app/onboardingCorporate/COD05463/EOD06803`);

    const links = getRegtankOnboardingViewLinks(
      person({
        parentCorporateRequestId: "COD05463",
        directorEodRequestId: "EOD06803",
        screeningRequestId: "KYC00006",
        requestId: "KYC00006",
      })
    );
    expect(links).toEqual([
      {
        label: "View",
        url: `${BASE}/app/onboardingCorporate/COD05463/EOD06803`,
        requestId: "EOD06803",
      },
    ]);
  });

  it("exposes two nested links when director and shareholder EODs differ", () => {
    const links = getRegtankOnboardingViewLinks(
      person({
        roles: ["DIRECTOR", "SHAREHOLDER"],
        sharePercentage: 60,
        parentCorporateRequestId: "COD05463",
        directorEodRequestId: "EOD06803",
        shareholderEodRequestId: "EOD06802",
        screeningRequestId: "KYC00006",
        requestId: "KYC00006",
      })
    );
    expect(links).toEqual([
      {
        label: "Director",
        url: `${BASE}/app/onboardingCorporate/COD05463/EOD06803`,
        requestId: "EOD06803",
      },
      {
        label: "Shareholder",
        url: `${BASE}/app/onboardingCorporate/COD05463/EOD06802`,
        requestId: "EOD06802",
      },
    ]);
  });

  it("keeps KYC screening as a separate link when KYC id also exists", () => {
    const row = person({
      parentCorporateRequestId: "COD05463",
      directorEodRequestId: "EOD06803",
      screeningRequestId: "KYC00006",
      requestId: "KYC00006",
    });
    const onboarding = getRegtankOnboardingViewLinks(row);
    expect(onboarding[0]?.url).toBe(`${BASE}/app/onboardingCorporate/COD05463/EOD06803`);
    expect(getRegtankScreeningLink(row)).toBe(`${BASE}/app/screen-kyc/result/KYC00006`);
  });

  it("keeps standalone personal LD/EOD on the liveness URL", () => {
    expect(getRegtankLivenessUrl("LD00011")).toBe(`${BASE}/app/liveness/LD00011?archived=false`);
    expect(getRegtankLivenessUrl("EOD06803")).toBe(`${BASE}/app/liveness/EOD06803?archived=false`);

    const links = getRegtankOnboardingViewLinks(
      person({
        parentCorporateRequestId: null,
        directorEodRequestId: "LD00011",
      })
    );
    expect(links).toEqual([
      {
        label: "View",
        url: `${BASE}/app/liveness/LD00011?archived=false`,
        requestId: "LD00011",
      },
    ]);
  });

  it("keeps organization-level company Open in RegTank on the COD URL", () => {
    expect(getRegtankCorporateOnboardingUrl("COD05463")).toBe(
      `${BASE}/app/onboardingCorporate/COD05463?archived=false`
    );
  });

  it("uses a corporate shareholder's own COD, not parent COD + EOD", () => {
    const links = getRegtankOnboardingViewLinks(
      person({
        matchKey: "123456789",
        name: "Child Co",
        entityType: "CORPORATE",
        roles: ["SHAREHOLDER"],
        parentCorporateRequestId: "COD05463",
        partyCorporateRequestId: "COD09999",
        directorEodRequestId: "EOD06803",
        screeningRequestId: "KYB00004",
      })
    );
    expect(links).toEqual([
      {
        label: "View",
        url: `${BASE}/app/onboardingCorporate/COD09999?archived=false`,
        requestId: "COD09999",
      },
    ]);
    expect(getRegtankScreeningLink(person({
      screeningRequestId: "KYB00004",
      screening: { status: "MATCH", riskLevel: "Low", riskScore: 1 },
    }))).toBe(`${BASE}/app/screen-kyb/result/KYB00004/riskAssessment`);
  });
});

describe("RegTank people-table column display", () => {
  it("shows director and shareholder EOD ids as separate onboarding rows", () => {
    const rows = getRegtankColumnDisplayRows(
      person({
        roles: ["DIRECTOR", "SHAREHOLDER"],
        sharePercentage: 60,
        parentCorporateRequestId: "COD05463",
        directorEodRequestId: "EOD06803",
        shareholderEodRequestId: "EOD06802",
        screeningRequestId: "KYC01234",
        requestId: "KYC01234",
      })
    );
    expect(rows).toEqual([
      {
        groupLabel: "Director",
        requestId: "EOD06803",
        url: `${BASE}/app/onboardingCorporate/COD05463/EOD06803`,
        kind: "onboarding",
      },
      {
        groupLabel: "Shareholder",
        requestId: "EOD06802",
        url: `${BASE}/app/onboardingCorporate/COD05463/EOD06802`,
        kind: "onboarding",
      },
      {
        groupLabel: "Screening",
        requestId: "KYC01234",
        url: `${BASE}/app/screen-kyc/result/KYC01234`,
        kind: "screening",
      },
    ]);
    expect(rows.map((r) => r.requestId)).not.toContain("COD05463");
  });

  it("shows a corporate shareholder's own COD in the column", () => {
    const rows = getRegtankColumnDisplayRows(
      person({
        matchKey: "123456789",
        name: "Child Co",
        entityType: "CORPORATE",
        roles: ["SHAREHOLDER"],
        parentCorporateRequestId: "COD05463",
        partyCorporateRequestId: "COD05464",
        screeningRequestId: "KYB00004",
      })
    );
    expect(rows[0]).toEqual({
      groupLabel: "Corporate Shareholder",
      requestId: "COD05464",
      url: `${BASE}/app/onboardingCorporate/COD05464?archived=false`,
      kind: "onboarding",
    });
    expect(rows[1]).toEqual({
      groupLabel: "Screening",
      requestId: "KYB00004",
      url: `${BASE}/app/screen-kyb/result/KYB00004`,
      kind: "screening",
    });
  });

  it("keeps screening as its own row and does not merge KYC into onboarding", () => {
    const rows = getRegtankColumnDisplayRows(
      person({
        parentCorporateRequestId: "COD05463",
        directorEodRequestId: "EOD06803",
        screeningRequestId: "KYC01234",
        requestId: "KYC01234",
      })
    );
    const onboarding = rows.filter((r) => r.kind === "onboarding");
    const screening = rows.filter((r) => r.kind === "screening");
    expect(onboarding).toHaveLength(1);
    expect(onboarding[0]?.requestId).toBe("EOD06803");
    expect(onboarding[0]?.url).toBe(`${BASE}/app/onboardingCorporate/COD05463/EOD06803`);
    expect(screening).toEqual([
      {
        groupLabel: "Screening",
        requestId: "KYC01234",
        url: `${BASE}/app/screen-kyc/result/KYC01234`,
        kind: "screening",
      },
    ]);
  });

  it("builds the dual-role row with KYC00176 on the result path, not scoring", () => {
    const rows = getRegtankColumnDisplayRows(
      person({
        name: "max chng",
        roles: ["DIRECTOR", "SHAREHOLDER"],
        sharePercentage: 98,
        parentCorporateRequestId: "COD05463",
        directorEodRequestId: "EOD06803",
        shareholderEodRequestId: "EOD06802",
        screeningRequestId: "KYC00176",
        requestId: "KYC00176",
      })
    );
    expect(rows).toEqual([
      {
        groupLabel: "Director",
        requestId: "EOD06803",
        url: `${BASE}/app/onboardingCorporate/COD05463/EOD06803`,
        kind: "onboarding",
      },
      {
        groupLabel: "Shareholder",
        requestId: "EOD06802",
        url: `${BASE}/app/onboardingCorporate/COD05463/EOD06802`,
        kind: "onboarding",
      },
      {
        groupLabel: "Screening",
        requestId: "KYC00176",
        url: `${BASE}/app/screen-kyc/result/KYC00176`,
        kind: "screening",
      },
    ]);
    expect(getRegtankScreeningLink(person({ screeningRequestId: "KYC00176" }))).toBe(
      `${BASE}/app/screen-kyc/result/KYC00176`
    );
    expect(getRegtankScreeningLink(person({ screeningRequestId: "KYC00176" }))).not.toContain("/scoring");
  });
});
