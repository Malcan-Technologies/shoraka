import { emptyPartyPlatformFields } from "./organization-party-profile";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import {
  computeHasPendingDirectorShareholder,
  getRelatedPartyFinalStatusLabel,
  RELATED_PARTY_COMPLIANCE_NOT_REQUIRED_LABEL,
  requiresRelatedPartyCompliance,
  type ApplicationPersonRow,
} from "./application-people-display";
import {
  adminPeopleAccessAmlChipPresentation,
  adminPeopleAccessKycChipPresentation,
  adminPeopleAccessRowAllowsRegTankSync,
  adminPeopleAccessRowNeedsAttention,
  buildAdminPeopleAccessRows,
  filterAdminPeopleAccessRows,
} from "./admin-people-access-rows";
import { peopleAccessAmlChipPresentation, peopleAccessKycChipPresentation } from "./people-access-rows";
import { getFinalStatusLabel } from "./director-shareholder-final-status";

const SSM = "202001012345";

function person(overrides: Partial<ApplicationPersonRow>): ApplicationPersonRow {
  return {
    matchKey: "900101015555",
    name: "Person",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    ...overrides,
  };
}

function company(overrides: Partial<ApplicationPersonRow>): ApplicationPersonRow {
  return person({
    matchKey: SSM,
    identityNumber: SSM,
    name: "Acme Holdings Sdn Bhd",
    entityType: "CORPORATE",
    roles: ["SHAREHOLDER"],
    sharePercentage: 30,
    onboarding: { status: null, id: null },
    screening: null,
    ...overrides,
  });
}

function companyParty(overrides: Partial<OrganizationPartyProfileDto> = {}): OrganizationPartyProfileDto {
  return {
    id: "party-co",
    partyKey: SSM,
    origin: "USER_ADDED",
    membershipStatus: "MASTER_ACTIVE",
    entityType: "CORPORATE",
    absentFromLatestExternal: false,
    name: "Acme Holdings Sdn Bhd",
    email: null,
    salutation: null,
    identityPrefix: "ROC",
    identityNumber: SSM,
    dateOfBirth: null,
    dateOfIncorporation: null,
    gender: null,
    nationality: null,
    countryOfIncorporation: null,
    address: null,
    isDirector: false,
    isShareholder: true,
    isBoard: false,
    isManagement: false,
    shareType: null,
    shareTypeOther: null,
    shareholdingUnits: null,
    shareholdingAmount: null,
    shareholdingPercentage: "30",
    designation: null,
    designationOther: null,
    appointmentDate: null,
    resignationDate: null,
    fieldSources: {},
    externalObservation: null,
    mismatches: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...emptyPartyPlatformFields(),
    ...overrides,
  } as OrganizationPartyProfileDto;
}

function peopleAccessRowFor(p: ApplicationPersonRow) {
  const { active } = buildAdminPeopleAccessRows({
    parties: [companyParty()],
    people: [p],
    members: [],
    owner: null,
  });
  const row = active.find((r) => r.partyId === "party-co");
  if (!row) throw new Error("company row not built");
  return row;
}

const exempt = company({ inInitialOnboarding: false });
const onboardingIncomplete = company({ inInitialOnboarding: true });
const onboardingComplete = company({
  inInitialOnboarding: true,
  onboarding: { status: "APPROVED", id: "COD1" },
  screening: { status: "APPROVED" },
});
const unknownCompany = company({});
const incompleteIndividual = person({ onboarding: { status: "IN_PROGRESS" }, screening: null });

describe("requiresRelatedPartyCompliance", () => {
  it("always requires individuals", () => {
    expect(requiresRelatedPartyCompliance({ entityType: "INDIVIDUAL" })).toBe(true);
    expect(requiresRelatedPartyCompliance({ entityType: "INDIVIDUAL", inInitialOnboarding: false })).toBe(true);
  });

  it("requires onboarding and unknown companies, exempts confirmed non-onboarding companies", () => {
    expect(requiresRelatedPartyCompliance(onboardingIncomplete)).toBe(true);
    expect(requiresRelatedPartyCompliance(unknownCompany)).toBe(true);
    expect(requiresRelatedPartyCompliance(exempt)).toBe(false);
  });
});

describe("computeHasPendingDirectorShareholder", () => {
  it("does not treat a confirmed non-onboarding company as pending", () => {
    expect(computeHasPendingDirectorShareholder([exempt])).toBe(false);
  });

  it("still blocks an incomplete initial-onboarding company", () => {
    expect(computeHasPendingDirectorShareholder([onboardingIncomplete])).toBe(true);
  });

  it("clears a complete initial-onboarding company", () => {
    expect(computeHasPendingDirectorShareholder([onboardingComplete])).toBe(false);
  });

  it("keeps existing blocking for a company with unknown membership", () => {
    expect(computeHasPendingDirectorShareholder([unknownCompany])).toBe(true);
  });

  it("keeps individual behaviour unchanged next to an exempt company", () => {
    expect(computeHasPendingDirectorShareholder([exempt, incompleteIndividual])).toBe(true);
    expect(
      computeHasPendingDirectorShareholder([
        exempt,
        person({ onboarding: { status: "APPROVED" }, screening: { status: "APPROVED" } }),
      ])
    ).toBe(false);
  });
});

describe("getRelatedPartyFinalStatusLabel", () => {
  it("shows Not required for an exempt company", () => {
    expect(getRelatedPartyFinalStatusLabel(exempt)).toEqual({
      label: RELATED_PARTY_COMPLIANCE_NOT_REQUIRED_LABEL,
      tone: "neutral",
      actor: "none",
    });
  });

  it("keeps the normal status for onboarding, unknown companies and individuals", () => {
    for (const p of [onboardingIncomplete, onboardingComplete, unknownCompany, incompleteIndividual]) {
      expect(getRelatedPartyFinalStatusLabel(p)).toEqual(
        getFinalStatusLabel({ screening: p.screening, onboarding: p.onboarding })
      );
    }
    expect(getRelatedPartyFinalStatusLabel(onboardingIncomplete).label).toBe("Not Started");
  });
});

describe("admin People & Access compliance", () => {
  it("does not flag an exempt company as needing attention and hides Sync RegTank", () => {
    const row = peopleAccessRowFor(exempt);
    expect(adminPeopleAccessRowNeedsAttention(row)).toBe(false);
    expect(filterAdminPeopleAccessRows([row], "pending", "")).toHaveLength(0);
    expect(adminPeopleAccessRowAllowsRegTankSync(row)).toBe(false);
    expect(adminPeopleAccessKycChipPresentation(row)?.label).toBe(RELATED_PARTY_COMPLIANCE_NOT_REQUIRED_LABEL);
    expect(adminPeopleAccessAmlChipPresentation(row)?.label).toBe(RELATED_PARTY_COMPLIANCE_NOT_REQUIRED_LABEL);
  });

  it("keeps attention, Sync RegTank and normal chips for onboarding and unknown companies", () => {
    for (const p of [onboardingIncomplete, unknownCompany]) {
      const row = peopleAccessRowFor(p);
      expect(adminPeopleAccessRowNeedsAttention(row)).toBe(true);
      expect(adminPeopleAccessRowAllowsRegTankSync(row)).toBe(true);
      expect(adminPeopleAccessKycChipPresentation(row)).toEqual(
        peopleAccessKycChipPresentation(row.person, { entityType: "CORPORATE" })
      );
      expect(adminPeopleAccessAmlChipPresentation(row)).toEqual(
        peopleAccessAmlChipPresentation(row.person, { entityType: "CORPORATE" })
      );
    }
  });

  it("treats a company row without a matched person as unknown (existing behaviour)", () => {
    const row = { ...peopleAccessRowFor(exempt), person: null };
    expect(adminPeopleAccessRowAllowsRegTankSync(row)).toBe(true);
    expect(adminPeopleAccessKycChipPresentation(row)).toBeNull();
  });

  it("does not change the shared issuer-facing chips", () => {
    expect(peopleAccessKycChipPresentation(exempt)).toEqual(peopleAccessKycChipPresentation(unknownCompany));
    expect(peopleAccessAmlChipPresentation(exempt)).toEqual(peopleAccessAmlChipPresentation(unknownCompany));
  });
});
