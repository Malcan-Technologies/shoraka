import type { ApplicationPersonRow, OrganizationPartyProfileDto } from "@cashsouk/types";
import {
  countProfileExternalReview,
  firstIncompleteProfileAnchor,
  formatMasterPartyRoles,
  formatSharePercent,
  unifyOrganizationPeople,
} from "./organization-profile-overview";

function party(
  overrides: Partial<OrganizationPartyProfileDto> & Pick<OrganizationPartyProfileDto, "id" | "partyKey">
): OrganizationPartyProfileDto {
  return {
    origin: "CTOS_PARTY",
    membershipStatus: "MASTER_ACTIVE",
    entityType: "INDIVIDUAL",
    absentFromLatestExternal: false,
    name: "Sarah Tan",
    salutation: null,
    identityPrefix: "NRIC",
    identityNumber: "900101145678",
    dateOfBirth: null,
    dateOfIncorporation: null,
    gender: "FEMALE",
    nationality: "Malaysian",
    countryOfIncorporation: null,
    address: null,
    isDirector: true,
    isShareholder: true,
    isBoard: true,
    isManagement: false,
    shareType: "ORDINARY",
    shareTypeOther: null,
    shareholdingUnits: "100",
    shareholdingAmount: "100",
    shareholdingPercentage: "20",
    designation: null,
    designationOther: null,
    appointmentDate: null,
    resignationDate: null,
    fieldSources: {},
    externalObservation: { name: "Sarah Tan" },
    mismatches: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("countProfileExternalReview", () => {
  it("counts CTOS differences, new parties, and absences separately", () => {
    const review = countProfileExternalReview([
      party({
        id: "1",
        partyKey: "a",
        mismatches: [
          { field: "shareholdingPercentage", masterValue: "20", externalValue: "25", source: "CTOS" },
          { field: "name", masterValue: "A", externalValue: "B", source: "CTOS" },
        ],
      }),
      party({
        id: "2",
        partyKey: "b",
        membershipStatus: "EXTERNAL_OBSERVED",
        name: "David Lim",
      }),
      party({
        id: "3",
        partyKey: "c",
        absentFromLatestExternal: true,
        name: "John Lee",
      }),
    ]);
    expect(review.mismatchCount).toBe(2);
    expect(review.newPartyCount).toBe(1);
    expect(review.absentCount).toBe(1);
    expect(review.total).toBe(4);
  });
});

describe("formatMasterPartyRoles", () => {
  it("joins director, board, and shareholder percent", () => {
    expect(formatMasterPartyRoles(party({ id: "1", partyKey: "a" }))).toBe(
      "Director · Board · Shareholder 20%"
    );
  });
});

describe("formatSharePercent", () => {
  it("drops trailing zeros", () => {
    expect(formatSharePercent("20.00")).toBe("20%");
    expect(formatSharePercent(25.5)).toBe("25.5%");
  });
});

describe("unifyOrganizationPeople", () => {
  it("attaches KYC people rows to the matching master party", () => {
    const people: ApplicationPersonRow[] = [
      {
        matchKey: "900101-14-5678",
        name: "Sarah Tan",
        entityType: "INDIVIDUAL",
        roles: ["DIRECTOR", "SHAREHOLDER"],
        sharePercentage: 20,
        status: "APPROVED",
        onboarding: { status: "APPROVED" },
        screening: { status: "APPROVED" },
      },
    ];
    const unified = unifyOrganizationPeople([party({ id: "p1", partyKey: "900101145678" })], people);
    expect(unified.master).toHaveLength(1);
    expect(unified.master[0]?.person?.name).toBe("Sarah Tan");
    expect(unified.peopleOnly).toHaveLength(0);
    expect(unified.external).toHaveLength(0);
  });
});

describe("firstIncompleteProfileAnchor", () => {
  it("sends shareholder gaps to the people tab", () => {
    expect(
      firstIncompleteProfileAnchor(
        {
          portal: "issuer",
          organizationType: "COMPANY",
          complete: false,
          percent: 80,
          steps: [],
          missing: [{ step: "shareholders", field: "name", label: "Shareholder name" }],
        },
        true
      )
    ).toEqual({ tab: "people", anchor: "profile-people" });
  });

  it("sends company activities to about the business", () => {
    expect(
      firstIncompleteProfileAnchor(
        {
          portal: "issuer",
          organizationType: "COMPANY",
          complete: false,
          percent: 80,
          steps: [],
          missing: [{ step: "company", field: "companyActivities", label: "Company activities" }],
        },
        true
      )
    ).toEqual({ tab: "organization", anchor: "profile-about" });
  });

  it("sends address gaps to the addresses section", () => {
    expect(
      firstIncompleteProfileAnchor(
        {
          portal: "issuer",
          organizationType: "COMPANY",
          complete: false,
          percent: 80,
          steps: [],
          missing: [{ step: "company", field: "registeredAddress.state", label: "Registered address — state" }],
        },
        true
      )
    ).toEqual({ tab: "organization", anchor: "profile-addresses" });
  });

  it("sends individual investor address gaps to residential address", () => {
    expect(
      firstIncompleteProfileAnchor(
        {
          portal: "investor",
          organizationType: "PERSONAL",
          complete: false,
          percent: 80,
          steps: [],
          missing: [{ step: "identity", field: "state", label: "Address — state" }],
        },
        false
      )
    ).toEqual({ tab: "organization", anchor: "profile-address" });
  });

  it("sends corporate investor company fields to company details", () => {
    expect(
      firstIncompleteProfileAnchor(
        {
          portal: "investor",
          organizationType: "COMPANY",
          complete: false,
          percent: 80,
          steps: [],
          missing: [{ step: "identity", field: "dateOfIncorporation", label: "Date of incorporation" }],
        },
        true
      )
    ).toEqual({ tab: "organization", anchor: "profile-company" });
  });

  it("sends investor category to classification", () => {
    expect(
      firstIncompleteProfileAnchor(
        {
          portal: "investor",
          organizationType: "PERSONAL",
          complete: false,
          percent: 90,
          steps: [],
          missing: [{ step: "identity", field: "scInvestorCategory", label: "Type of investor" }],
        },
        false
      )
    ).toEqual({ tab: "organization", anchor: "profile-classification" });
  });
});
