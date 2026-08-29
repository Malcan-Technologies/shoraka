jest.mock("../../lib/audit", () => ({
  createOnboardingLogRow: jest.fn(async () => undefined),
}));

import { UserRole } from "@prisma/client";
import { createOnboardingLogRow } from "../../lib/audit";
import { logOrganizationMembershipEvent } from "./membership-audit";

const createOnboardingLogRowMock = createOnboardingLogRow as jest.MockedFunction<
  typeof createOnboardingLogRow
>;

describe("logOrganizationMembershipEvent", () => {
  beforeEach(() => {
    createOnboardingLogRowMock.mockClear();
  });

  it("writes MEMBER_ADDED with actor, organisation, member, and new role", async () => {
    await logOrganizationMembershipEvent({
      eventType: "MEMBER_ADDED",
      actorUserId: "admin-1",
      ownerUserId: "owner-1",
      organizationId: "org-1",
      portalType: "issuer",
      organizationName: "ABC Trading",
      organizationReference: "ISS-202608-DK3",
      memberUserId: "member-1",
      memberEmail: "member@example.com",
      newRole: "ORGANIZATION_MEMBER",
    });
    expect(createOnboardingLogRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        eventType: "MEMBER_ADDED",
        issuerOrganizationId: "org-1",
        role: UserRole.ISSUER,
        metadata: expect.objectContaining({
          action: "MEMBER_ADDED",
          organizationId: "org-1",
          organizationReference: "ISS-202608-DK3",
          memberUserId: "member-1",
          memberEmail: "member@example.com",
          newRole: "ORGANIZATION_MEMBER",
        }),
      }),
      expect.anything()
    );
  });

  it("writes MEMBER_INVITED with invitation id and email", async () => {
    await logOrganizationMembershipEvent({
      eventType: "MEMBER_INVITED",
      actorUserId: "admin-1",
      ownerUserId: "owner-1",
      organizationId: "org-1",
      portalType: "investor",
      memberEmail: "invitee@example.com",
      newRole: "ORGANIZATION_ADMIN",
      invitationId: "inv-1",
    });
    expect(createOnboardingLogRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MEMBER_INVITED",
        investorOrganizationId: "org-1",
        metadata: expect.objectContaining({
          memberEmail: "invitee@example.com",
          newRole: "ORGANIZATION_ADMIN",
          invitationId: "inv-1",
        }),
      }),
      expect.anything()
    );
  });

  it("writes MEMBER_REMOVED with previous role", async () => {
    await logOrganizationMembershipEvent({
      eventType: "MEMBER_REMOVED",
      actorUserId: "admin-1",
      ownerUserId: "owner-1",
      organizationId: "org-1",
      portalType: "issuer",
      memberUserId: "member-1",
      memberEmail: "member@example.com",
      previousRole: "ORGANIZATION_MEMBER",
    });
    expect(createOnboardingLogRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MEMBER_REMOVED",
        metadata: expect.objectContaining({
          memberUserId: "member-1",
          previousRole: "ORGANIZATION_MEMBER",
        }),
      }),
      expect.anything()
    );
  });

  it("writes MEMBER_ROLE_CHANGED with previous and new role", async () => {
    await logOrganizationMembershipEvent({
      eventType: "MEMBER_ROLE_CHANGED",
      actorUserId: "admin-1",
      ownerUserId: "owner-1",
      organizationId: "org-1",
      portalType: "issuer",
      memberUserId: "member-1",
      previousRole: "ORGANIZATION_MEMBER",
      newRole: "ORGANIZATION_ADMIN",
    });
    expect(createOnboardingLogRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MEMBER_ROLE_CHANGED",
        metadata: expect.objectContaining({
          previousRole: "ORGANIZATION_MEMBER",
          newRole: "ORGANIZATION_ADMIN",
        }),
      }),
      expect.anything()
    );
  });

  it("never stores the organisation UUID as organizationReference", async () => {
    await logOrganizationMembershipEvent({
      eventType: "MEMBER_ADDED",
      actorUserId: "admin-1",
      ownerUserId: "owner-1",
      organizationId: "org-uuid",
      portalType: "issuer",
      organizationReference: "org-uuid",
      memberUserId: "member-1",
    });
    const metadata = createOnboardingLogRowMock.mock.calls[0]?.[0]?.metadata as Record<
      string,
      unknown
    >;
    expect(metadata.organizationId).toBe("org-uuid");
    expect(metadata).not.toHaveProperty("organizationReference");
  });
});
