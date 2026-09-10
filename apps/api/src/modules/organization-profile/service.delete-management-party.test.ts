const mockFindFirst = jest.fn();
const mockDelete = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

import { OrganizationPartyOrigin } from "@prisma/client";
import { deleteManagementParty } from "./service";

describe("deleteManagementParty eligibility", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockDelete.mockReset();
  });

  it("deletes USER_ADDED management-only people", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "party-a",
      origin: OrganizationPartyOrigin.USER_ADDED,
      is_director: false,
      is_shareholder: false,
    });
    mockDelete.mockResolvedValueOnce({ id: "party-a" });
    await deleteManagementParty({
      portal: "issuer",
      organizationId: "org-a",
      partyId: "party-a",
    });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "party-a" } });
  });

  it("does not hard-delete directors or shareholders", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "party-dir",
      origin: OrganizationPartyOrigin.USER_ADDED,
      is_director: true,
      is_shareholder: false,
    });
    await expect(
      deleteManagementParty({
        portal: "issuer",
        organizationId: "org-a",
        partyId: "party-dir",
      })
    ).rejects.toMatchObject({ code: "INVALID_PARTY" });
    expect(mockDelete).not.toHaveBeenCalled();

    mockFindFirst.mockResolvedValueOnce({
      id: "party-sh",
      origin: OrganizationPartyOrigin.USER_ADDED,
      is_director: false,
      is_shareholder: true,
    });
    await expect(
      deleteManagementParty({
        portal: "issuer",
        organizationId: "org-a",
        partyId: "party-sh",
      })
    ).rejects.toMatchObject({ code: "INVALID_PARTY" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("does not hard-delete CTOS/RegTank historical records", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "party-ctos",
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      is_director: false,
      is_shareholder: false,
    });
    await expect(
      deleteManagementParty({
        portal: "issuer",
        organizationId: "org-a",
        partyId: "party-ctos",
      })
    ).rejects.toMatchObject({ code: "INVALID_PARTY" });
    expect(mockDelete).not.toHaveBeenCalled();

    mockFindFirst.mockResolvedValueOnce({
      id: "party-rt",
      origin: OrganizationPartyOrigin.REGTANK_PARTY,
      is_director: false,
      is_shareholder: false,
    });
    await expect(
      deleteManagementParty({
        portal: "issuer",
        organizationId: "org-a",
        partyId: "party-rt",
      })
    ).rejects.toMatchObject({ code: "INVALID_PARTY" });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
