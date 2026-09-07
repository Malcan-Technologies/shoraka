/**
 * @jest-environment node
 */
import { buildPartyProfileDetailItems } from "./party-profile-detail-fields";
import type { OrganizationPartyProfileDto } from "@cashsouk/types";

function party(partial: Partial<OrganizationPartyProfileDto>): OrganizationPartyProfileDto {
  return {
    id: "p1",
    partyKey: "900101101234",
    origin: "USER_ADDED",
    membershipStatus: "MASTER_ACTIVE",
    entityType: "INDIVIDUAL",
    absentFromLatestExternal: false,
    name: "Ivan Chew Ken Yoong",
    salutation: null,
    identityPrefix: "NRIC",
    identityNumber: "900101101234",
    dateOfBirth: "1990-01-01",
    dateOfIncorporation: null,
    gender: "MALE",
    nationality: "MALAYSIA",
    countryOfIncorporation: null,
    address: { line1: "1 Jalan A", line2: null, state: "Selangor", postalCode: "40000" },
    isDirector: true,
    isShareholder: true,
    isBoard: true,
    isManagement: false,
    shareType: "ORDINARY",
    shareTypeOther: null,
    shareholdingUnits: "1000",
    shareholdingAmount: "2500",
    shareholdingPercentage: "20",
    designation: "CHIEF_EXECUTIVE_OFFICER",
    designationOther: null,
    appointmentDate: "2020-01-01",
    resignationDate: null,
    fieldSources: {},
    externalObservation: null,
    mismatches: [],
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("buildPartyProfileDetailItems", () => {
  it("shows name, identity, and multi-role facts for one master party", () => {
    const items = buildPartyProfileDetailItems({ party: party({}) });
    const labels = items.map((item) => item.label);
    expect(items.find((item) => item.label === "Name")?.value).toBe("Ivan Chew Ken Yoong");
    const identity = items.find((item) => item.value === "900101101234");
    expect(identity).toBeDefined();
    expect(labels).toContain("Shareholding Percentage (%)");
    expect(labels).not.toContain("Type of Shares - Others (please specify)");
    expect(labels).not.toContain("Designation - Others (please specify)");
  });

  it("hides salutation and officer-only fields for a company shareholder", () => {
    const items = buildPartyProfileDetailItems({
      party: party({
        entityType: "CORPORATE",
        isDirector: false,
        isBoard: false,
        isManagement: false,
        isShareholder: true,
        identityPrefix: "ROC",
        gender: "NOT_APPLICABLE",
        dateOfBirth: null,
        dateOfIncorporation: "2018-04-01",
        countryOfIncorporation: "MALAYSIA",
        designation: null,
        appointmentDate: null,
      }),
    });
    const labels = items.map((item) => item.label);
    expect(labels).not.toContain("Salutation");
    expect(labels).not.toContain("Designation");
    expect(items.find((item) => item.label === "Entity type")?.value).toBe("Company");
  });

  it("does not dump empty ComRep fields when only operational person data exists", () => {
    const items = buildPartyProfileDetailItems({
      person: {
        matchKey: "900101101234",
        name: "Ivan Chew Ken Yoong",
        entityType: "INDIVIDUAL",
        roles: ["DIRECTOR", "SHAREHOLDER"],
        sharePercentage: 20,
        status: "",
        action: null,
        screening: null,
        onboarding: { status: "APPROVED", id: "kyc-1" },
        requestId: null,
        requestIdType: null,
        icFrontUrl: null,
        icBackUrl: null,
        email: "ivan@example.com",
      },
    });
    const labels = items.map((item) => item.label);
    expect(labels).toContain("Name");
    expect(labels).toContain("E-mail");
    expect(labels).not.toContain("Residential Address");
    expect(labels).not.toContain("Designation");
  });
});
