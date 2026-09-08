jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { OrganizationPartyEntityType, OrganizationPartyMembershipStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { assertPartyBelongsToOrganization, linkPartyProfileToUser } from "./party-platform-link";

const findFirst = prisma.organizationPartyProfile.findFirst as jest.Mock;
const update = prisma.organizationPartyProfile.update as jest.Mock;

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

describe("party-platform-link", () => {
  beforeEach(() => {
    findFirst.mockReset();
    update.mockReset();
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
    findFirst
      .mockResolvedValueOnce(party())
      .mockResolvedValueOnce(null);
    update.mockResolvedValueOnce({});
    await linkPartyProfileToUser({
      partyId: "clparty000000000000000001",
      userId: "AAAAA",
      organizationId: "org-1",
      portalType: "issuer",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "clparty000000000000000001" },
      data: { user_id: "AAAAA" },
    });
  });

  it("rejects linking a person already tied to a different user", async () => {
    findFirst.mockResolvedValueOnce(party({ user_id: "BBBBB", user: { user_id: "BBBBB", email: "b@x.com" } }));
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
    findFirst
      .mockResolvedValueOnce(party())
      .mockResolvedValueOnce({ id: "other-party" });
    await expect(
      linkPartyProfileToUser({
        partyId: "clparty000000000000000001",
        userId: "AAAAA",
        organizationId: "org-1",
        portalType: "issuer",
      })
    ).rejects.toMatchObject({ code: "USER_ALREADY_LINKED" });
  });
});
