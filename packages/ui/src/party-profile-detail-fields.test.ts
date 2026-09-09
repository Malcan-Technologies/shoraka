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
    email: null,
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
    userId: null,
    linkedUser: null,
    platformAccess: {
      status: "NOT_INVITED",
      label: "Not invited",
      memberRole: null,
      invitationId: null,
      invitationExpiresAt: null,
    },
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
    expect(labels).toContain("Email");
    expect(labels).not.toContain("Residential Address");
    expect(labels).not.toContain("Designation");
  });

  it("keeps onboarding email separate from platform login email", () => {
    const items = buildPartyProfileDetailItems({
      party: party({
        linkedUser: {
          userId: "AAAAA",
          email: "login@example.com",
          firstName: "Ivan",
          lastName: "Chew",
        },
      }),
      person: {
        matchKey: "900101101234",
        name: "Ivan Chew Ken Yoong",
        entityType: "INDIVIDUAL",
        roles: ["DIRECTOR"],
        sharePercentage: 20,
        status: "",
        action: null,
        screening: null,
        onboarding: null,
        requestId: null,
        requestIdType: null,
        icFrontUrl: null,
        icBackUrl: null,
        email: "onboarding@example.com",
      },
    });
    expect(items.find((item) => item.label === "Email")?.value).toBe(
      "onboarding@example.com"
    );
    expect(items.find((item) => item.label === "Platform login email")?.value).toBe(
      "login@example.com"
    );
  });

  it("says CTOS when the person is missing from or differs from the latest CTOS information", () => {
    const absent = buildPartyProfileDetailItems({
      party: party({ absentFromLatestExternal: true }),
    });
    expect(absent.find((item) => item.label === "Latest CTOS information")?.value).toBe(
      "This person was not found in the latest CTOS information."
    );
    const mismatch = buildPartyProfileDetailItems({
      party: party({
        mismatches: [
          {
            field: "shareholdingPercentage",
            masterValue: "20",
            externalValue: "25",
            source: "CTOS",
          },
        ],
      }),
    });
    expect(mismatch.find((item) => item.label === "Latest CTOS information")?.value).toBe(
      "CTOS information differs from the current profile."
    );
  });
});
