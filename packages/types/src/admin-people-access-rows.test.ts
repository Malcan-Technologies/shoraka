import { emptyPartyPlatformFields } from "./organization-party-profile";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import type { ApplicationPersonRow } from "./application-people-display";
import { resolvePersonPlatformAccess } from "./person-platform-access";
import type { PeopleAccessMember } from "./people-access-rows";
import {
  adminPeopleAccessCtosLabel,
  buildAdminPeopleAccessRows,
  filterAdminPeopleAccessRows,
  picContactsDiffer,
  type AdminPeopleAccessOwner,
} from "./admin-people-access-rows";

function party(
  overrides: Partial<OrganizationPartyProfileDto> & Pick<OrganizationPartyProfileDto, "id" | "partyKey">
): OrganizationPartyProfileDto {
  return {
    origin: "MANUAL",
    membershipStatus: "MASTER_ACTIVE",
    entityType: "INDIVIDUAL",
    absentFromLatestExternal: false,
    name: "Unnamed",
    email: null,
    salutation: null,
    identityPrefix: "NRIC",
    identityNumber: null,
    dateOfBirth: null,
    dateOfIncorporation: null,
    gender: null,
    nationality: null,
    countryOfIncorporation: null,
    address: null,
    isDirector: false,
    isShareholder: false,
    isBoard: false,
    isManagement: false,
    shareType: null,
    shareTypeOther: null,
    shareholdingUnits: null,
    shareholdingAmount: null,
    shareholdingPercentage: null,
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
  };
}

function person(overrides: Partial<ApplicationPersonRow> & Pick<ApplicationPersonRow, "matchKey">): ApplicationPersonRow {
  return {
    name: "Unnamed",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    ...overrides,
  };
}

function member(overrides: Partial<PeopleAccessMember> & Pick<PeopleAccessMember, "id">): PeopleAccessMember {
  return {
    email: `${overrides.id}@example.com`,
    firstName: "User",
    lastName: overrides.id,
    role: "ORGANIZATION_MEMBER",
    ...overrides,
  };
}

const owner: AdminPeopleAccessOwner = {
  userId: "owner-1",
  email: "owner@example.com",
  firstName: "Lucas",
  lastName: "Deng",
};

function access(status: "NOT_INVITED" | "ORGANIZATION_MEMBER" | "ORGANIZATION_ADMIN" | "INVITATION_PENDING" | "INVITATION_EXPIRED") {
  return resolvePersonPlatformAccess({
    linkedUserId:
      status === "ORGANIZATION_MEMBER" || status === "ORGANIZATION_ADMIN" ? "linked" : null,
    members:
      status === "ORGANIZATION_MEMBER"
        ? [{ userId: "linked", role: "ORGANIZATION_MEMBER" }]
        : status === "ORGANIZATION_ADMIN"
          ? [{ userId: "linked", role: "ORGANIZATION_ADMIN" }]
          : [],
    invitations:
      status === "INVITATION_PENDING" || status === "INVITATION_EXPIRED"
        ? [
            {
              id: "inv-1",
              partyProfileId: "p1",
              accepted: false,
              expiresAt:
                status === "INVITATION_PENDING"
                  ? "2026-12-01T00:00:00.000Z"
                  : "2026-01-01T00:00:00.000Z",
            },
          ]
        : [],
    partyId: "p1",
    now: new Date("2026-06-01T00:00:00.000Z"),
  });
}

describe("buildAdminPeopleAccessRows", () => {
  it("1. master active company person with no platform access", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "p1",
          partyKey: "IC1",
          name: "Mary Lim",
          identityNumber: "IC1",
          isDirector: true,
          platformAccess: access("NOT_INVITED"),
        }),
      ],
      people: [
        person({
          matchKey: "IC1",
          name: "Mary Lim",
          onboarding: { status: "APPROVED" },
          screening: { status: "WAIT_FOR_APPROVAL" },
        }),
      ],
      members: [],
      owner,
    });
    expect(active).toHaveLength(2);
    const row = active.find((item) => item.partyId === "p1")!;
    expect(row.companyRoleLine).toBe("Director");
    expect(row.platformAccess).toBe("No access");
    expect(row.kyc).toBe("Approved");
    expect(row.aml).toBe("Pending");
  });

  it("2–4. master + User / Admin / Owner and does not duplicate the linked user", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "p1",
          partyKey: "IC1",
          name: "John Tan",
          identityNumber: "IC1",
          isDirector: true,
          isShareholder: true,
          userId: "u-user",
          platformAccess: {
            ...emptyPartyPlatformFields().platformAccess,
            status: "ORGANIZATION_MEMBER",
            label: "Organization Member",
            memberRole: "ORGANIZATION_MEMBER",
          },
          linkedUser: { userId: "u-user", email: "john@ex.com", firstName: "John", lastName: "Tan" },
        }),
        party({
          id: "p2",
          partyKey: "IC2",
          name: "Admin Person",
          identityNumber: "IC2",
          isDirector: true,
          userId: "u-admin",
          platformAccess: {
            ...emptyPartyPlatformFields().platformAccess,
            status: "ORGANIZATION_ADMIN",
            label: "Organization Admin",
            memberRole: "ORGANIZATION_ADMIN",
          },
        }),
        party({
          id: "p3",
          partyKey: "IC3",
          name: "David Lee",
          identityNumber: "IC3",
          isDirector: true,
          isShareholder: true,
          userId: "owner-1",
          platformAccess: {
            ...emptyPartyPlatformFields().platformAccess,
            status: "ORGANIZATION_ADMIN",
            label: "Organization Admin",
            memberRole: "ORGANIZATION_ADMIN",
          },
        }),
      ],
      people: [],
      members: [
        member({ id: "u-user", firstName: "John", lastName: "Tan", role: "ORGANIZATION_MEMBER" }),
        member({ id: "u-admin", firstName: "A", lastName: "Dmin", role: "ORGANIZATION_ADMIN" }),
        member({ id: "owner-1", firstName: "Lucas", lastName: "Deng", role: "ORGANIZATION_ADMIN" }),
      ],
      owner,
    });
    const byId = Object.fromEntries(active.filter((row) => row.partyId).map((row) => [row.partyId, row]));
    expect(byId.p1.platformAccess).toBe("User");
    expect(byId.p2.platformAccess).toBe("Admin");
    expect(byId.p3.platformAccess).toBe("Owner");
    expect(byId.p3.companyRoleLine).toBe("Director, Shareholder");
    expect(active.filter((row) => row.kind === "platform_only")).toHaveLength(0);
    expect(active.filter((row) => row.userId === "u-user")).toHaveLength(1);
  });

  it("5–7. platform-only User, Admin, and Owner (including owner without a member row)", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [],
      people: [],
      members: [
        member({ id: "u-user", firstName: "Sarah", lastName: "Wong", role: "ORGANIZATION_MEMBER" }),
        member({ id: "u-admin", firstName: "Pat", lastName: "Admin", role: "ORGANIZATION_ADMIN" }),
      ],
      owner,
    });
    const labels = active.map((row) => [row.name, row.platformAccess, row.kyc, row.aml, row.ctos]);
    expect(labels).toEqual(
      expect.arrayContaining([
        ["Sarah Wong", "User", "—", "—", "—"],
        ["Pat Admin", "Admin", "—", "—", "—"],
        ["Lucas Deng", "Owner", "—", "—", "—"],
      ])
    );
    expect(active.find((row) => row.platformAccess === "Owner")?.companyRoleLine).toBe("—");
  });

  it("8–9. person-scoped pending and expired invitations stay on the company-person row", () => {
    const pending = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "p1",
          partyKey: "IC1",
          name: "Invited",
          identityNumber: "IC1",
          isDirector: true,
          platformAccess: access("INVITATION_PENDING"),
        }),
      ],
      people: [],
      members: [],
      owner,
    }).active.find((row) => row.partyId === "p1")!;
    expect(pending.platformAccess).toBe("Invitation sent");

    const expired = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "p1",
          partyKey: "IC1",
          name: "Invited",
          identityNumber: "IC1",
          isDirector: true,
          platformAccess: access("INVITATION_EXPIRED"),
        }),
      ],
      people: [],
      members: [],
      owner,
    }).active.find((row) => row.partyId === "p1")!;
    expect(expired.platformAccess).toBe("Invitation expired");
  });

  it("does not invent unscoped invitation rows", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [],
      people: [],
      members: [],
      owner,
    });
    expect(active.some((row) => row.kind === "unscoped_invite")).toBe(false);
  });

  it("10. EXTERNAL_OBSERVED is Observed only with no platform access", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "obs-1",
          partyKey: "IC9",
          name: "Alex Ng",
          identityNumber: "IC9",
          isDirector: true,
          membershipStatus: "EXTERNAL_OBSERVED",
        }),
      ],
      people: [],
      members: [],
      owner,
    });
    const row = active.find((item) => item.partyId === "obs-1")!;
    expect(row.kind).toBe("observed");
    expect(row.ctos).toBe("Observed only");
    expect(row.platformAccess).toBe("—");
    expect(row.kyc).toBe("—");
    expect(row.aml).toBe("—");
  });

  it("11–12. CTOS Differs and Not found", () => {
    expect(
      adminPeopleAccessCtosLabel(
        party({
          id: "p1",
          partyKey: "a",
          mismatches: [{ field: "name", masterValue: "A", externalValue: "B", source: "CTOS" }],
          externalObservation: { name: "B" },
        })
      )
    ).toBe("Differs");
    expect(
      adminPeopleAccessCtosLabel(
        party({
          id: "p1",
          partyKey: "a",
          absentFromLatestExternal: true,
          externalObservation: { name: "A" },
        })
      )
    ).toBe("Not found");
    expect(
      adminPeopleAccessCtosLabel(
        party({
          id: "p1",
          partyKey: "a",
          externalObservation: { name: "A" },
        })
      )
    ).toBe("Matched");
  });

  it("13–14. inactive rows keep platform access independently", () => {
    const { active, inactive } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "inactive-1",
          partyKey: "IC1",
          name: "Gone",
          identityNumber: "IC1",
          isDirector: true,
          membershipStatus: "MASTER_INACTIVE",
          userId: "u-still",
          platformAccess: {
            ...emptyPartyPlatformFields().platformAccess,
            status: "ORGANIZATION_MEMBER",
            label: "Organization Member",
            memberRole: "ORGANIZATION_MEMBER",
          },
        }),
        party({
          id: "inactive-2",
          partyKey: "IC2",
          name: "Gone No Access",
          identityNumber: "IC2",
          isShareholder: true,
          membershipStatus: "MASTER_INACTIVE",
        }),
      ],
      people: [],
      members: [member({ id: "u-still", firstName: "Still", lastName: "Here" })],
      owner,
    });
    expect(active.some((row) => row.userId === "u-still" && row.kind === "platform_only")).toBe(false);
    expect(inactive.find((row) => row.partyId === "inactive-1")?.platformAccess).toBe("User");
    expect(inactive.find((row) => row.partyId === "inactive-1")?.inactive).toBe(true);
    expect(inactive.find((row) => row.partyId === "inactive-2")?.platformAccess).toBe("No access");
  });

  it("15 + 23. corporate shareholder has no individual KYC or platform access", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "corp-1",
          partyKey: "ROC1",
          name: "ABC Holdings Sdn Bhd",
          identityNumber: "ROC1",
          entityType: "CORPORATE",
          isShareholder: true,
          shareholdingPercentage: "40",
          externalObservation: { name: "ABC" },
        }),
      ],
      people: [
        person({
          matchKey: "ROC1",
          name: "ABC Holdings Sdn Bhd",
          entityType: "CORPORATE",
          roles: ["SHAREHOLDER"],
          sharePercentage: 40,
          screening: { status: "APPROVED" },
        }),
      ],
      members: [],
      owner,
    });
    const row = active.find((item) => item.partyId === "corp-1")!;
    expect(row.companyRoleLine).toBe("Shareholder");
    expect(row.platformAccess).toBe("—");
    expect(row.kyc).toBe("—");
    expect(row.aml).toBe("Approved");
    expect(row.ctos).toBe("Matched");
    expect(row.corporate).toBe(true);
  });

  it("16. people-only unmatched rows are not merged by email", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "p1",
          partyKey: "IC1",
          name: "On File",
          identityNumber: "IC1",
          email: "same@example.com",
          isDirector: true,
        }),
      ],
      people: [
        person({
          matchKey: "IC99",
          name: "Other Person",
          email: "same@example.com",
          roles: ["DIRECTOR"],
        }),
      ],
      members: [],
      owner,
    });
    expect(active.filter((row) => row.kind === "people_only")).toHaveLength(1);
    expect(active.find((row) => row.kind === "people_only")?.platformAccess).toBe("—");
    expect(active.filter((row) => row.kind === "company_person" || row.kind === "people_only")).toHaveLength(2);
  });

  it("17. identity conflict is flagged and CTOS shows Differs", () => {
    const blocked = {
      identityConflict: {
        status: "BLOCKED",
        canonicalIdentity: "IC1",
        otherPartyId: "obs-1",
        otherPartyKey: "IC1",
        otherMembershipStatus: "EXTERNAL_OBSERVED",
        source: "CTOS_OBSERVE",
        at: "2026-01-01T00:00:00.000Z",
      },
    };
    const { active } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "onb-1",
          partyKey: "GEN1",
          name: "Onboarding",
          isDirector: true,
          externalObservation: blocked,
        }),
        party({
          id: "obs-1",
          partyKey: "IC1",
          name: "CTOS",
          identityNumber: "IC1",
          isDirector: true,
          membershipStatus: "EXTERNAL_OBSERVED",
        }),
      ],
      people: [],
      members: [],
      owner,
    });
    const master = active.find((row) => row.partyId === "onb-1")!;
    const observed = active.find((row) => row.partyId === "obs-1")!;
    expect(master.identityConflict).toBe(true);
    expect(master.ctos).toBe("Differs");
    expect(observed.identityConflict).toBe(true);
    expect(observed.ctos).toBe("Observed only");
  });

  it("does not merge linked person and user by email", () => {
    const { active } = buildAdminPeopleAccessRows({
      parties: [
        party({
          id: "p1",
          partyKey: "IC1",
          name: "Person",
          identityNumber: "IC1",
          email: "shared@example.com",
          isDirector: true,
        }),
      ],
      people: [],
      members: [member({ id: "u-other", email: "shared@example.com", firstName: "Other", lastName: "User" })],
      owner,
    });
    expect(active.filter((row) => row.kind === "company_person")).toHaveLength(1);
    expect(active.filter((row) => row.kind === "platform_only" && row.userId === "u-other")).toHaveLength(1);
  });
});

describe("filterAdminPeopleAccessRows", () => {
  const built = buildAdminPeopleAccessRows({
    parties: [
      party({
        id: "p1",
        partyKey: "IC1",
        name: "Mary Lim",
        identityNumber: "IC1",
        email: "mary.person@ex.com",
        isDirector: true,
        mismatches: [{ field: "name", masterValue: "Mary", externalValue: "M", source: "CTOS" }],
      }),
      party({
        id: "obs-1",
        partyKey: "IC9",
        name: "Alex Ng",
        identityNumber: "IC9",
        isDirector: true,
        membershipStatus: "EXTERNAL_OBSERVED",
      }),
      party({
        id: "in-1",
        partyKey: "IC8",
        name: "Inactive Person",
        identityNumber: "IC8",
        isDirector: true,
        membershipStatus: "MASTER_INACTIVE",
      }),
    ],
    people: [],
    members: [member({ id: "u-user", firstName: "Sarah", lastName: "Wong" })],
    owner,
  });
  const all = [...built.active, ...built.inactive];

  it("All excludes inactive", () => {
    const rows = filterAdminPeopleAccessRows(all, "all", "");
    expect(rows.some((row) => row.inactive)).toBe(false);
    expect(rows.some((row) => row.partyId === "obs-1")).toBe(true);
  });

  it("Company people includes observed and company roles", () => {
    const rows = filterAdminPeopleAccessRows(all, "company", "");
    expect(rows.every((row) => row.companyRoles.length > 0)).toBe(true);
    expect(rows.every((row) => row.kind !== "platform_only")).toBe(true);
  });

  it("Platform access is Owner/Admin/User only", () => {
    const rows = filterAdminPeopleAccessRows(all, "platform", "");
    expect(rows.every((row) => ["Owner", "Admin", "User"].includes(row.platformAccess))).toBe(true);
  });

  it("Pending and CTOS review include observed and differs", () => {
    const pending = filterAdminPeopleAccessRows(all, "pending", "");
    const ctos = filterAdminPeopleAccessRows(all, "ctos-review", "");
    expect(pending.some((row) => row.ctos === "Observed only")).toBe(true);
    expect(pending.some((row) => row.ctos === "Differs")).toBe(true);
    expect(ctos.every((row) => row.ctos === "Observed only" || row.ctos === "Differs" || row.ctos === "Not found" || row.identityConflict)).toBe(true);
  });

  it("Inactive is MASTER_INACTIVE only", () => {
    const rows = filterAdminPeopleAccessRows(all, "inactive", "");
    expect(rows).toHaveLength(1);
    expect(rows[0].partyId).toBe("in-1");
  });

  it("search matches name, person email, and identity", () => {
    expect(filterAdminPeopleAccessRows(all, "all", "mary.person").map((row) => row.partyId)).toEqual(["p1"]);
    expect(filterAdminPeopleAccessRows(all, "all", "IC9").map((row) => row.partyId)).toEqual(["obs-1"]);
  });
});

describe("picContactsDiffer", () => {
  it("does not treat empty evidence as a difference", () => {
    expect(picContactsDiffer({ name: "A" }, {})).toBe(false);
  });

  it("detects a differing RegTank evidence block", () => {
    expect(
      picContactsDiffer(
        { name: "A", position: "CFO", email: "a@x.com", contact: "1" },
        { name: "B", position: "CFO", email: "a@x.com", contactNumber: "1" }
      )
    ).toBe(true);
  });
});
