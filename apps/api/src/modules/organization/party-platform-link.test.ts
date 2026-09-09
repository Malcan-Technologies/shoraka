jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    issuerOrganizationInvitation: {
      updateMany: jest.fn(),
    },
    investorOrganizationInvitation: {
      updateMany: jest.fn(),
    },
  },
}));

import {
  OrganizationMemberRole,
  OrganizationPartyEntityType,
  OrganizationPartyMembershipStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import {
  applyPersonScopedInvitationAcceptance,
  assertPartyActiveForPlatformInvite,
  assertPartyBelongsToOrganization,
  assertPersonScopedPlaceholderAllowed,
  claimPartyProfileUserLink,
  isPlaceholderInvitationEmail,
  linkPartyProfileToUser,
} from "./party-platform-link";

const findFirst = prisma.organizationPartyProfile.findFirst as jest.Mock;
const updateMany = prisma.organizationPartyProfile.updateMany as jest.Mock;
const memberFindFirst = prisma.organizationMember.findFirst as jest.Mock;
const memberCreate = prisma.organizationMember.create as jest.Mock;
const issuerInviteUpdateMany = prisma.issuerOrganizationInvitation.updateMany as jest.Mock;

function party(overrides: Record<string, unknown> = {}) {
  return {
    id: "clparty000000000000000001",
    entity_type: OrganizationPartyEntityType.INDIVIDUAL,
    membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
    user_id: null,
    issuer_organization_id: "org-1",
    investor_organization_id: null,
    user: null,
    ...overrides,
  };
}

function memoryDb(store: { userId: string | null }) {
  return {
    organizationPartyProfile: {
      findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args.where ?? {};
        if (where.NOT) {
          if (
            store.userId &&
            where.user_id === store.userId &&
            where.issuer_organization_id === "org-1"
          ) {
            return { id: "other-party" };
          }
          return null;
        }
        return party({ user_id: null });
      }),
      updateMany: jest.fn(async (args: { where: { OR?: Array<{ user_id: string | null }> }; data: { user_id: string } }) => {
        const matches = (args.where.OR ?? []).some(
          (clause) =>
            (clause.user_id === null && store.userId === null) ||
            (clause.user_id !== null && clause.user_id === store.userId)
        );
        if (!matches) {
          return { count: 0 };
        }
        store.userId = args.data.user_id;
        return { count: 1 };
      }),
    },
  };
}

describe("party-platform-link", () => {
  beforeEach(() => {
    findFirst.mockReset();
    updateMany.mockReset();
    memberFindFirst.mockReset();
    memberCreate.mockReset();
    issuerInviteUpdateMany.mockReset();
  });

  it("rejects corporate parties as platform users", async () => {
    findFirst.mockResolvedValueOnce(party({ entity_type: OrganizationPartyEntityType.CORPORATE }));
    await expect(
      assertPartyBelongsToOrganization({
        partyId: "clparty000000000000000001",
        organizationId: "org-1",
        portalType: "issuer",
      })
    ).rejects.toMatchObject({ code: "CORPORATE_PARTY" });
  });

  it("does not infer a link from email — only persists user_id when asked", async () => {
    findFirst.mockResolvedValueOnce(party()).mockResolvedValueOnce(null);
    updateMany.mockResolvedValueOnce({ count: 1 });
    await linkPartyProfileToUser({
      partyId: "clparty000000000000000001",
      userId: "AAAAA",
      organizationId: "org-1",
      portalType: "issuer",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "clparty000000000000000001",
        OR: [{ user_id: null }, { user_id: "AAAAA" }],
      },
      data: { user_id: "AAAAA" },
    });
  });

  it("rejects linking a person already tied to a different user", async () => {
    findFirst.mockResolvedValueOnce(
      party({ user_id: "BBBBB", user: { user_id: "BBBBB", email: "b@x.com" } })
    );
    await expect(
      linkPartyProfileToUser({
        partyId: "clparty000000000000000001",
        userId: "AAAAA",
        organizationId: "org-1",
        portalType: "issuer",
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects one user linked to two people in the same organization", async () => {
    findFirst.mockResolvedValueOnce(party()).mockResolvedValueOnce({ id: "other-party" });
    await expect(
      linkPartyProfileToUser({
        partyId: "clparty000000000000000001",
        userId: "AAAAA",
        organizationId: "org-1",
        portalType: "issuer",
      })
    ).rejects.toMatchObject({ code: "USER_ALREADY_LINKED" });
  });

  it("maps a unique-index violation to USER_ALREADY_LINKED", async () => {
    findFirst.mockResolvedValueOnce(party()).mockResolvedValueOnce(null);
    updateMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    await expect(
      claimPartyProfileUserLink({
        partyId: "clparty000000000000000001",
        userId: "AAAAA",
        organizationId: "org-1",
        portalType: "issuer",
      })
    ).rejects.toMatchObject({ code: "USER_ALREADY_LINKED" });
  });

  it("second claim cannot overwrite Person.user_id with a different User", async () => {
    const store = { userId: null as string | null };
    const db = memoryDb(store) as never;
    await claimPartyProfileUserLink({
      partyId: "clparty000000000000000001",
      userId: "AAAAA",
      organizationId: "org-1",
      portalType: "issuer",
      db,
    });
    await expect(
      claimPartyProfileUserLink({
        partyId: "clparty000000000000000001",
        userId: "BBBBB",
        organizationId: "org-1",
        portalType: "issuer",
        db,
      })
    ).rejects.toMatchObject({ code: "PERSON_ALREADY_LINKED" });
    expect(store.userId).toBe("AAAAA");
  });

  it("allows the same User to be linked in a different organization", async () => {
    const store = { userId: "AAAAA" as string | null };
    const db = {
      organizationPartyProfile: {
        findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
          const where = args.where ?? {};
          if (where.NOT) {
            expect(where.issuer_organization_id).toBe("org-B");
            return null;
          }
          return party({
            id: "clparty000000000000000002",
            issuer_organization_id: "org-B",
            user_id: null,
          });
        }),
        updateMany: jest.fn(async () => {
          store.userId = "AAAAA";
          return { count: 1 };
        }),
      },
    } as never;
    await expect(
      claimPartyProfileUserLink({
        partyId: "clparty000000000000000002",
        userId: "AAAAA",
        organizationId: "org-B",
        portalType: "issuer",
        db,
      })
    ).resolves.toBe("created");
  });
});

describe("Person-scoped placeholder and inactive guards", () => {
  it("treats invitation-*@cashsouk.com as a placeholder", () => {
    expect(isPlaceholderInvitationEmail("invitation-123@cashsouk.com")).toBe(true);
    expect(isPlaceholderInvitationEmail("darren@example.com")).toBe(false);
  });

  it("blocks an unlinked Person-scoped placeholder from being claimed", () => {
    expect(() =>
      assertPersonScopedPlaceholderAllowed({
        invitationEmail: "invitation-1@cashsouk.com",
        partyUserId: null,
        acceptingUserId: "AAAAA",
      })
    ).toThrow(expect.objectContaining({ code: "PERSON_INVITE_REQUIRES_EMAIL" }));
  });

  it("allows a placeholder only to restore the already-linked User", () => {
    expect(() =>
      assertPersonScopedPlaceholderAllowed({
        invitationEmail: "invitation-1@cashsouk.com",
        partyUserId: "AAAAA",
        acceptingUserId: "AAAAA",
      })
    ).not.toThrow();
    expect(() =>
      assertPersonScopedPlaceholderAllowed({
        invitationEmail: "invitation-1@cashsouk.com",
        partyUserId: "AAAAA",
        acceptingUserId: "BBBBB",
      })
    ).toThrow(expect.objectContaining({ code: "PERSON_ALREADY_LINKED" }));
  });

  it("rejects platform invite/restore for an inactive Person", () => {
    expect(() =>
      assertPartyActiveForPlatformInvite({
        membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE,
      })
    ).toThrow(expect.objectContaining({ code: "PERSON_INACTIVE" }));
  });
});

describe("applyPersonScopedInvitationAcceptance", () => {
  beforeEach(() => {
    findFirst.mockReset();
    updateMany.mockReset();
    memberFindFirst.mockReset();
    memberCreate.mockReset();
    issuerInviteUpdateMany.mockReset();
  });
  it("commits member + Person link + accepted invite together", async () => {
    findFirst
      .mockResolvedValueOnce(party())
      .mockResolvedValueOnce(party())
      .mockResolvedValueOnce(null);
    updateMany.mockResolvedValue({ count: 1 });
    memberFindFirst.mockResolvedValue(null);
    memberCreate.mockResolvedValue({ id: "mem-1" });
    issuerInviteUpdateMany.mockResolvedValue({ count: 1 });

    const result = await applyPersonScopedInvitationAcceptance({
      db: prisma,
      partyId: "clparty000000000000000001",
      organizationId: "org-1",
      portalType: "issuer",
      acceptingUserId: "AAAAA",
      invitationId: "inv-1",
      invitationRole: OrganizationMemberRole.ORGANIZATION_MEMBER,
    });

    expect(result).toEqual({ link: "created", membershipCreated: true });
    expect(memberCreate).toHaveBeenCalled();
    expect(issuerInviteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "inv-1",
        accepted: false,
        expires_at: { gt: expect.any(Date) },
      },
      data: { accepted: true, accepted_at: expect.any(Date) },
    });
  });

  it("does not create membership when the Person link cannot be claimed", async () => {
    findFirst
      .mockResolvedValueOnce(party({ user_id: "BBBBB" }))
      .mockResolvedValueOnce(party({ user_id: "BBBBB" }));
    await expect(
      applyPersonScopedInvitationAcceptance({
        db: prisma,
        partyId: "clparty000000000000000001",
        organizationId: "org-1",
        portalType: "issuer",
        acceptingUserId: "AAAAA",
        invitationId: "inv-1",
        invitationRole: OrganizationMemberRole.ORGANIZATION_MEMBER,
      })
    ).rejects.toMatchObject({ code: "PERSON_ALREADY_LINKED" });
    expect(memberCreate).not.toHaveBeenCalled();
    expect(issuerInviteUpdateMany).not.toHaveBeenCalled();
  });

  it("rolls the invitation accept back to the caller when it cannot be marked accepted", async () => {
    findFirst
      .mockResolvedValueOnce(party())
      .mockResolvedValueOnce(party())
      .mockResolvedValueOnce(null);
    updateMany.mockResolvedValue({ count: 1 });
    memberFindFirst.mockResolvedValue(null);
    memberCreate.mockResolvedValue({ id: "mem-1" });
    issuerInviteUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      applyPersonScopedInvitationAcceptance({
        db: prisma,
        partyId: "clparty000000000000000001",
        organizationId: "org-1",
        portalType: "issuer",
        acceptingUserId: "AAAAA",
        invitationId: "inv-1",
        invitationRole: OrganizationMemberRole.ORGANIZATION_MEMBER,
      })
    ).rejects.toMatchObject({ code: "ALREADY_ACCEPTED" });
    expect(memberCreate).toHaveBeenCalled();
  });
});
