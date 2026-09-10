import { emptyPartyPlatformFields } from "./organization-party-profile";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import type { ApplicationPersonRow } from "./application-people-display";
import {
  buildPeopleAccessRows,
  filterPeopleAccessRows,
  peopleAccessAmlLabel,
  peopleAccessCorporateKybLabel,
  peopleAccessKycLabel,
  peopleAccessPlatformLabel,
  type PeopleAccessInvitation,
  type PeopleAccessMember,
} from "./people-access-rows";
import { resolvePersonPlatformAccess } from "./person-platform-access";

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

const now = new Date("2026-06-01T00:00:00.000Z");

describe("peopleAccessPlatformLabel", () => {
  it("maps owner_user_id to Owner even when the member role is Admin", () => {
    expect(
      peopleAccessPlatformLabel({
        ownerUserId: "u1",
        userId: "u1",
        status: "ORGANIZATION_ADMIN",
      })
    ).toBe("Owner");
  });

  it("maps ORGANIZATION_MEMBER to User, not Organization Member", () => {
    expect(
      peopleAccessPlatformLabel({
        ownerUserId: "owner",
        userId: "u2",
        status: "ORGANIZATION_MEMBER",
      })
    ).toBe("User");
  });
});

describe("peopleAccessKycLabel / peopleAccessAmlLabel", () => {
  const eligible = person({ matchKey: "p1", roles: ["DIRECTOR"] });

  it("uses — when KYC is not applicable", () => {
    expect(peopleAccessKycLabel(null)).toBe("—");
    expect(
      peopleAccessKycLabel(person({ matchKey: "c1", entityType: "CORPORATE", roles: ["SHAREHOLDER"], sharePercentage: 40 }))
    ).toBe("—");
    expect(
      peopleAccessKycLabel(person({ matchKey: "b1", roles: ["BOARD"], sharePercentage: null }))
    ).toBe("—");
  });

  it("maps KYC groups", () => {
    expect(peopleAccessKycLabel({ ...eligible, onboarding: { status: "NOT_STARTED" } })).toBe("Not started");
    expect(peopleAccessKycLabel({ ...eligible, onboarding: { status: "IN_PROGRESS" } })).toBe("In progress");
    expect(peopleAccessKycLabel({ ...eligible, onboarding: { status: "WAIT_FOR_APPROVAL" } })).toBe(
      "Pending approval"
    );
    expect(peopleAccessKycLabel({ ...eligible, onboarding: { status: "APPROVED" } })).toBe("Approved");
    expect(peopleAccessKycLabel({ ...eligible, onboarding: { status: "REJECTED" } })).toBe("Rejected");
    expect(peopleAccessKycLabel({ ...eligible, onboarding: { status: "EXPIRED" } })).toBe("Expired");
  });

  it("maps AML independently of KYC", () => {
    const kycApproved = { ...eligible, onboarding: { status: "APPROVED" }, screening: { status: "PENDING" } };
    expect(peopleAccessKycLabel(kycApproved)).toBe("Approved");
    expect(peopleAccessAmlLabel(kycApproved)).toBe("Pending");
    expect(peopleAccessAmlLabel({ ...eligible, screening: { status: "NOT_STARTED" } })).toBe("Not started");
    expect(peopleAccessAmlLabel({ ...eligible, screening: { status: "CLEAR" } })).toBe("Approved");
    expect(peopleAccessAmlLabel({ ...eligible, screening: { status: "FAILED" } })).toBe("Rejected");
    expect(peopleAccessAmlLabel({ ...eligible, screening: { status: "UNDER_REVIEW" } })).toBe("Pending");
  });

  it("does not show Not started when no KYC is expected", () => {
    expect(
      peopleAccessKycLabel(
        person({ matchKey: "m1", roles: ["MANAGEMENT"], onboarding: { status: "NOT_STARTED" } })
      )
    ).toBe("—");
  });
});

describe("peopleAccessCorporateKybLabel", () => {
  it("maps corporate COD onboarding without using individual KYC eligibility", () => {
    const corp = person({
      matchKey: "ROC1",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      sharePercentage: 50,
    });
    expect(peopleAccessCorporateKybLabel(corp)).toBe("—");
    expect(peopleAccessCorporateKybLabel({ ...corp, onboarding: { status: "WAIT_FOR_APPROVAL" } })).toBe(
      "Pending approval"
    );
    expect(peopleAccessCorporateKybLabel({ ...corp, onboarding: { status: "ID_UPLOADED" } })).toBe(
      "In progress"
    );
    expect(peopleAccessKycLabel({ ...corp, onboarding: { status: "WAIT_FOR_APPROVAL" } })).toBe("—");
  });
});

describe("buildPeopleAccessRows", () => {
  it("shows a company person without login as No access", () => {
    const mary = party({
      id: "party-mary",
      partyKey: "IC1",
      name: "Mary Lim",
      isShareholder: true,
      email: "mary@co.com",
    });
    const { active } = buildPeopleAccessRows({
      parties: [mary],
      people: [
        person({
          matchKey: "IC1",
          name: "Mary Lim",
          roles: ["SHAREHOLDER"],
          sharePercentage: 10,
          onboarding: { status: "APPROVED" },
          screening: { status: "CLEAR" },
        }),
      ],
      members: [],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      kind: "company_person",
      name: "Mary Lim",
      companyRoleLine: "Shareholder",
      platformAccess: "No access",
      kyc: "Approved",
      aml: "Approved",
      partyId: "party-mary",
    });
  });

  it("shows a platform user without a company role once, with KYC/AML —", () => {
    const { active } = buildPeopleAccessRows({
      parties: [],
      people: [],
      members: [member({ id: "sarah", firstName: "Sarah", lastName: "Wong", role: "ORGANIZATION_ADMIN" })],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    const sarah = active.find((row) => row.userId === "sarah");
    expect(sarah).toMatchObject({
      kind: "platform_only",
      name: "Sarah Wong",
      companyRoleLine: "—",
      platformAccess: "Admin",
      kyc: "—",
      aml: "—",
    });
  });

  it("does not duplicate a linked company person as a platform-only row", () => {
    const davidUser = member({ id: "david", firstName: "David", lastName: "Lee" });
    const davidParty = party({
      id: "party-david",
      partyKey: "IC-DAVID",
      name: "David Lee",
      isDirector: true,
      userId: "david",
      linkedUser: { userId: "david", email: "david@login.com", firstName: "David", lastName: "Lee" },
      platformAccess: resolvePersonPlatformAccess({
        linkedUserId: "david",
        members: [{ userId: "david", role: "ORGANIZATION_MEMBER" }],
        invitations: [],
        partyId: "party-david",
        now,
      }),
    });
    const { active } = buildPeopleAccessRows({
      parties: [davidParty],
      people: [person({ matchKey: "IC-DAVID", name: "David Lee", roles: ["DIRECTOR"] })],
      members: [davidUser, member({ id: "owner", firstName: "Owner", lastName: "One", role: "ORGANIZATION_ADMIN" })],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active.filter((row) => row.name === "David Lee")).toHaveLength(1);
    expect(active.find((row) => row.partyId === "party-david")?.platformAccess).toBe("User");
    expect(active.filter((row) => row.userId === "david")).toHaveLength(1);
  });

  it("shows Owner without a company role as a platform-only Owner row", () => {
    const { active } = buildPeopleAccessRows({
      parties: [],
      people: [],
      members: [member({ id: "owner", firstName: "Pat", lastName: "Owner", role: "ORGANIZATION_ADMIN" })],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      kind: "platform_only",
      platformAccess: "Owner",
      companyRoleLine: "—",
      kyc: "—",
      userId: "owner",
    });
  });

  it("shows Owner with a company role on the company-person row, not twice", () => {
    const ownerParty = party({
      id: "party-owner",
      partyKey: "IC-OWNER",
      name: "Pat Owner",
      isDirector: true,
      userId: "owner",
      platformAccess: resolvePersonPlatformAccess({
        linkedUserId: "owner",
        members: [{ userId: "owner", role: "ORGANIZATION_ADMIN" }],
        invitations: [],
        partyId: "party-owner",
        now,
      }),
    });
    const { active } = buildPeopleAccessRows({
      parties: [ownerParty],
      people: [person({ matchKey: "IC-OWNER", name: "Pat Owner", roles: ["DIRECTOR"] })],
      members: [member({ id: "owner", firstName: "Pat", lastName: "Owner", role: "ORGANIZATION_ADMIN" })],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      kind: "company_person",
      platformAccess: "Owner",
      companyRoleLine: "Director",
      partyId: "party-owner",
    });
  });

  it("keeps Director + Shareholder on one row", () => {
    const { active } = buildPeopleAccessRows({
      parties: [
        party({
          id: "party-js",
          partyKey: "IC-JS",
          name: "John Tan",
          isDirector: true,
          isShareholder: true,
        }),
      ],
      people: [
        person({
          matchKey: "IC-JS",
          name: "John Tan",
          roles: ["DIRECTOR", "SHAREHOLDER"],
          sharePercentage: 20,
        }),
      ],
      members: [],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active).toHaveLength(1);
    expect(active[0].companyRoleLine).toBe("Director, Shareholder");
  });

  it("shows a pending person-scoped invite on the same company-person row", () => {
    const invite: PeopleAccessInvitation = {
      id: "inv-1",
      email: "david@co.com",
      role: "ORGANIZATION_MEMBER",
      expiresAt: "2026-07-01T00:00:00.000Z",
      partyProfileId: "party-david",
    };
    const david = party({
      id: "party-david",
      partyKey: "IC-D",
      name: "David Lee",
      isDirector: true,
      email: "david@co.com",
      platformAccess: resolvePersonPlatformAccess({
        linkedUserId: null,
        members: [],
        invitations: [{ id: invite.id, partyProfileId: invite.partyProfileId ?? null, accepted: false, expiresAt: invite.expiresAt }],
        partyId: "party-david",
        now,
      }),
    });
    const { active } = buildPeopleAccessRows({
      parties: [david],
      people: [person({ matchKey: "IC-D", name: "David Lee", roles: ["DIRECTOR"] })],
      members: [],
      invitations: [invite],
      ownerUserId: "owner",
      now,
    });
    expect(active.filter((row) => row.kind === "unscoped_invite")).toHaveLength(0);
    expect(active.filter((row) => row.partyId === "party-david")).toHaveLength(1);
    expect(active[0].platformAccess).toBe("Invitation sent");
    expect(active[0].invitationId).toBe("inv-1");
  });

  it("shows an expired person-scoped invite on the same row", () => {
    const invite: PeopleAccessInvitation = {
      id: "inv-exp",
      email: "david@co.com",
      role: "ORGANIZATION_MEMBER",
      expiresAt: "2026-01-01T00:00:00.000Z",
      partyProfileId: "party-david",
    };
    const david = party({
      id: "party-david",
      partyKey: "IC-D",
      name: "David Lee",
      isDirector: true,
      platformAccess: resolvePersonPlatformAccess({
        linkedUserId: null,
        members: [],
        invitations: [{ id: invite.id, partyProfileId: "party-david", accepted: false, expiresAt: invite.expiresAt }],
        partyId: "party-david",
        now,
      }),
    });
    const { active } = buildPeopleAccessRows({
      parties: [david],
      people: [person({ matchKey: "IC-D", name: "David Lee", roles: ["DIRECTOR"] })],
      members: [],
      invitations: [invite],
      ownerUserId: "owner",
      now,
    });
    expect(active[0].platformAccess).toBe("Invitation expired");
    expect(active.filter((row) => row.kind === "unscoped_invite")).toHaveLength(0);
  });

  it("shows pending and expired unscoped invites as their own rows", () => {
    const { active } = buildPeopleAccessRows({
      parties: [],
      people: [],
      members: [],
      invitations: [
        {
          id: "u1",
          email: "finance@company.com",
          role: "ORGANIZATION_MEMBER",
          expiresAt: "2026-07-01T00:00:00.000Z",
          partyProfileId: null,
        },
        {
          id: "u2",
          email: "old@company.com",
          role: "ORGANIZATION_ADMIN",
          expiresAt: "2026-01-01T00:00:00.000Z",
          partyProfileId: null,
        },
      ],
      ownerUserId: "owner",
      now,
    });
    expect(active.map((row) => [row.key, row.platformAccess])).toEqual([
      ["invite:u1", "Invitation sent"],
      ["invite:u2", "Invitation expired"],
    ]);
    expect(active.every((row) => row.kyc === "—" && row.aml === "—" && row.companyRoleLine === "—")).toBe(
      true
    );
  });

  it("does not merge rows by email", () => {
    const partyRow = party({
      id: "party-a",
      partyKey: "IC-A",
      name: "Alex Party",
      email: "same@co.com",
      isDirector: true,
    });
    const { active } = buildPeopleAccessRows({
      parties: [partyRow],
      people: [person({ matchKey: "IC-A", name: "Alex Party", roles: ["DIRECTOR"], email: "same@co.com" })],
      members: [member({ id: "other", firstName: "Other", lastName: "User", email: "same@co.com" })],
      invitations: [
        {
          id: "inv-same",
          email: "same@co.com",
          role: "ORGANIZATION_MEMBER",
          expiresAt: "2026-07-01T00:00:00.000Z",
          partyProfileId: null,
        },
      ],
      ownerUserId: "owner",
      now,
    });
    expect(active.map((row) => row.key).sort()).toEqual(
      ["invite:inv-same", "party:party-a", "user:other"].sort()
    );
  });

  it("keeps an inactive company person out of the active table", () => {
    const { active, inactive } = buildPeopleAccessRows({
      parties: [
        party({
          id: "party-old",
          partyKey: "IC-OLD",
          name: "Old Person",
          isDirector: true,
          membershipStatus: "MASTER_INACTIVE",
        }),
      ],
      people: [person({ matchKey: "IC-OLD", name: "Old Person", roles: ["DIRECTOR"] })],
      members: [],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active).toHaveLength(0);
    expect(inactive).toHaveLength(1);
    expect(inactive[0].partyId).toBe("party-old");
  });

  it("treats remove-access (linked user, no membership) as No access on the company person", () => {
    const { active } = buildPeopleAccessRows({
      parties: [
        party({
          id: "party-d",
          partyKey: "IC-D",
          name: "David Lee",
          isDirector: true,
          userId: "david",
          platformAccess: resolvePersonPlatformAccess({
            linkedUserId: "david",
            members: [],
            invitations: [],
            partyId: "party-d",
            now,
          }),
        }),
      ],
      people: [person({ matchKey: "IC-D", name: "David Lee", roles: ["DIRECTOR"] })],
      members: [],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active).toHaveLength(1);
    expect(active[0].platformAccess).toBe("No access");
    expect(active[0].companyRoleLine).toBe("Director");
    expect(active[0].userId).toBe("david");
  });

  it("does not change company roles when the owner is a different user", () => {
    const { active } = buildPeopleAccessRows({
      parties: [
        party({
          id: "party-d",
          partyKey: "IC-D",
          name: "David Lee",
          isDirector: true,
          isShareholder: true,
          userId: "david",
          platformAccess: resolvePersonPlatformAccess({
            linkedUserId: "david",
            members: [{ userId: "david", role: "ORGANIZATION_ADMIN" }],
            invitations: [],
            partyId: "party-d",
            now,
          }),
        }),
      ],
      people: [
        person({
          matchKey: "IC-D",
          name: "David Lee",
          roles: ["DIRECTOR", "SHAREHOLDER"],
          sharePercentage: 15,
        }),
      ],
      members: [
        member({ id: "david", firstName: "David", lastName: "Lee", role: "ORGANIZATION_ADMIN" }),
        member({ id: "owner", firstName: "Pat", lastName: "Owner", role: "ORGANIZATION_ADMIN" }),
      ],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    const david = active.find((row) => row.partyId === "party-d");
    const owner = active.find((row) => row.userId === "owner");
    expect(david?.platformAccess).toBe("Admin");
    expect(david?.companyRoleLine).toBe("Director, Shareholder");
    expect(owner?.platformAccess).toBe("Owner");
    expect(owner?.companyRoleLine).toBe("—");
  });

  it("keeps people-only CTOS rows until a party exists", () => {
    const { active } = buildPeopleAccessRows({
      parties: [],
      people: [person({ matchKey: "IC-NEW", name: "New From Ctos", roles: ["DIRECTOR"] })],
      members: [],
      invitations: [],
      ownerUserId: "owner",
      now,
    });
    expect(active[0]).toMatchObject({
      kind: "people_only",
      key: "people:IC-NEW",
      platformAccess: "No access",
    });
  });
});

describe("filterPeopleAccessRows", () => {
  const rows = buildPeopleAccessRows({
    parties: [
      party({ id: "p1", partyKey: "IC1", name: "Mary Lim", isShareholder: true }),
    ],
    people: [person({ matchKey: "IC1", name: "Mary Lim", roles: ["SHAREHOLDER"], sharePercentage: 8 })],
    members: [member({ id: "sarah", firstName: "Sarah", lastName: "Wong", role: "ORGANIZATION_ADMIN" })],
    invitations: [
      {
        id: "u1",
        email: "finance@company.com",
        role: "ORGANIZATION_MEMBER",
        expiresAt: "2026-07-01T00:00:00.000Z",
        partyProfileId: null,
      },
    ],
    ownerUserId: "owner",
    now,
  }).active;

  it("filters pending invitations without duplicating person-scoped rows", () => {
    expect(filterPeopleAccessRows(rows, "pending", "").map((row) => row.key)).toEqual(["invite:u1"]);
  });

  it("filters company people separately from platform access", () => {
    expect(filterPeopleAccessRows(rows, "company", "").map((row) => row.kind)).toEqual(["company_person"]);
    expect(filterPeopleAccessRows(rows, "platform", "").every((row) => row.kind === "platform_only")).toBe(
      true
    );
  });
});
