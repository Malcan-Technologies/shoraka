import type { ApplicationPersonRow } from "./application-people-display";
import {
  collectPartyRegTankRefreshIds,
  isLaterAddedCompanyPerson,
  shouldShowPartyAmlRefresh,
  shouldShowPartyKycRefresh,
} from "./people-access-refresh";

function person(overrides: Partial<ApplicationPersonRow> = {}): ApplicationPersonRow {
  return {
    matchKey: "user:jamie",
    name: "Jamie Lim",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    ...overrides,
  };
}

describe("later-added People & Access refresh visibility", () => {
  it("later-added individual pending → refresh visible", () => {
    const row = person({
      onboarding: { status: "WAIT_FOR_APPROVAL", id: "LD1001" },
      screening: { status: "PENDING", id: "KYC1001" },
      requestId: "LD1001",
      screeningRequestId: "KYC1001",
    });
    const params = {
      person: row,
      origin: "USER_ADDED" as const,
      partyKey: "user:jamie",
      kind: "company_person",
    };
    expect(shouldShowPartyKycRefresh(params)).toBe(true);
    expect(shouldShowPartyAmlRefresh(params)).toBe(true);
  });

  it("later-added individual approved → refresh hidden", () => {
    const row = person({
      onboarding: { status: "APPROVED", id: "LD1001" },
      screening: { status: "CLEAR", id: "KYC1001" },
      requestId: "LD1001",
      screeningRequestId: "KYC1001",
    });
    const params = {
      person: row,
      origin: "USER_ADDED" as const,
      partyKey: "user:jamie",
      kind: "company_person",
    };
    expect(shouldShowPartyKycRefresh(params)).toBe(false);
    expect(shouldShowPartyAmlRefresh(params)).toBe(false);
  });

  it("later-added corporate pending → refresh visible", () => {
    const row = person({
      matchKey: "199501012345",
      name: "ABC Berhad",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      sharePercentage: 30,
      onboarding: { status: "IN_PROGRESS", id: "COD2001" },
      screening: { status: "PENDING", id: "KYB2001" },
      partyCorporateRequestId: "COD2001",
      screeningRequestId: "KYB2001",
    });
    const params = {
      person: row,
      origin: "USER_ADDED" as const,
      partyKey: "199501012345",
      kind: "company_person",
    };
    expect(shouldShowPartyKycRefresh(params)).toBe(true);
    expect(shouldShowPartyAmlRefresh(params)).toBe(true);
  });

  it("later-added corporate approved → refresh hidden", () => {
    const row = person({
      matchKey: "199501012345",
      name: "ABC Berhad",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      sharePercentage: 30,
      onboarding: { status: "APPROVED", id: "COD2001" },
      screening: { status: "APPROVED", id: "KYB2001" },
      partyCorporateRequestId: "COD2001",
      screeningRequestId: "KYB2001",
    });
    const params = {
      person: row,
      origin: "USER_ADDED" as const,
      partyKey: "199501012345",
      kind: "company_person",
    };
    expect(shouldShowPartyKycRefresh(params)).toBe(false);
    expect(shouldShowPartyAmlRefresh(params)).toBe(false);
  });

  it("hides refresh when there is no RegTank request to query", () => {
    const row = person({ onboarding: { status: "IN_PROGRESS" } });
    expect(
      shouldShowPartyKycRefresh({
        person: row,
        origin: "USER_ADDED",
        partyKey: "user:jamie",
        kind: "company_person",
      })
    ).toBe(false);
  });

  it("does not show refresh for initial CTOS parties", () => {
    const row = person({
      matchKey: "900101145678",
      onboarding: { status: "IN_PROGRESS", id: "EOD1" },
      directorEodRequestId: "EOD1",
    });
    expect(
      shouldShowPartyKycRefresh({
        person: row,
        origin: "CTOS_PARTY",
        partyKey: "900101145678",
        kind: "company_person",
      })
    ).toBe(false);
    expect(isLaterAddedCompanyPerson({ origin: "CTOS_PARTY", partyKey: "900101145678" })).toBe(false);
  });

  it("does not use the parent organisation COD as a party refresh id", () => {
    const ids = collectPartyRegTankRefreshIds(
      person({
        parentCorporateRequestId: "COD-PARENT",
        onboarding: { status: "IN_PROGRESS" },
      })
    );
    expect(ids.corporateOnboardingRequestId).toBeNull();
  });
});
