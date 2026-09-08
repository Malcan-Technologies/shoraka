import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import { OrganizationMemberRole, User } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

const mockGetOrganization = jest.fn();
const mockInactivateMasterParty = jest.fn();
const mockAuthState = {
  user: { user_id: "owner-1" } as Pick<User, "user_id">,
  adminPermissions: ["organizations.view", "organizations.manage"] as string[] | null,
};

jest.mock("../organization/service", () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({
    getOrganization: (...args: unknown[]) => mockGetOrganization(...args),
  })),
}));

jest.mock("./service", () => ({
  adoptObservedParty: jest.fn(),
  assertIssuerProfileCompleteForSubmit: jest.fn(),
  computeOrgProfileCompleteness: jest.fn(),
  createUserAddedParty: jest.fn(),
  deleteManagementParty: jest.fn(),
  getIssuerFinancialSummary: jest.fn(),
  inactivateMasterParty: (...args: unknown[]) => mockInactivateMasterParty(...args),
  listPartyProfiles: jest.fn(),
  patchIssuerOrgFinancials: jest.fn(),
  patchOrgMasterProfile: jest.fn(),
  patchPartyProfile: jest.fn(),
  resolvePartyMismatch: jest.fn(),
  seedMasterPartiesIfEmpty: jest.fn(),
}));

jest.mock("../../lib/audit/account-logs", () => ({
  createSecurityLogRow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/auth/middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = mockAuthState.user as User;
    next();
  },
  requirePermission:
    (...needed: string[]) =>
    (req: Request, _res: Response, next: NextFunction) => {
      if (
        !mockAuthState.adminPermissions ||
        !needed.every((permission) => mockAuthState.adminPermissions?.includes(permission))
      ) {
        next(new AppError(403, "FORBIDDEN", "Insufficient permissions"));
        return;
      }
      next();
    },
}));

import {
  createAdminOrganizationProfileRouter,
  createOrganizationProfileRouter,
} from "./controller";

const orgA = {
  owner_user_id: "owner-1",
  members: [
    { user_id: "owner-1", role: OrganizationMemberRole.ORGANIZATION_ADMIN },
    { user_id: "admin-1", role: OrganizationMemberRole.ORGANIZATION_ADMIN },
    { user_id: "member-1", role: OrganizationMemberRole.ORGANIZATION_MEMBER },
  ],
};

describe("issuer and admin party inactivation routes", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/v1/organizations", createOrganizationProfileRouter());
    app.use("/v1/admin/organizations", createAdminOrganizationProfileRouter());
    app.use((err: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    });
    jest.clearAllMocks();
    mockAuthState.user = { user_id: "owner-1" };
    mockAuthState.adminPermissions = ["organizations.view", "organizations.manage"];
    mockGetOrganization.mockImplementation(async (userId: string, organizationId: string) => {
      if (organizationId !== "org-a") {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
      }
      const isMember =
        orgA.owner_user_id === userId || orgA.members.some((member) => member.user_id === userId);
      if (!isMember) {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
      }
      return orgA;
    });
    mockInactivateMasterParty.mockResolvedValue({
      id: "party-a",
      membershipStatus: "MASTER_INACTIVE",
    });
  });

  it("lets an issuer owner mark an active member inactive", async () => {
    mockAuthState.user = { user_id: "owner-1" };
    const response = await request(app).post(
      "/v1/organizations/issuer/org-a/party-profiles/party-a/inactivate"
    );
    expect(response.status).toBe(200);
    expect(response.body.data.membershipStatus).toBe("MASTER_INACTIVE");
    expect(mockInactivateMasterParty).toHaveBeenCalledWith({
      portal: "issuer",
      organizationId: "org-a",
      partyId: "party-a",
    });
  });

  it("lets an issuer organization admin mark an active member inactive", async () => {
    mockAuthState.user = { user_id: "admin-1" };
    const response = await request(app).post(
      "/v1/organizations/issuer/org-a/party-profiles/party-a/inactivate"
    );
    expect(response.status).toBe(200);
    expect(mockInactivateMasterParty).toHaveBeenCalledWith({
      portal: "issuer",
      organizationId: "org-a",
      partyId: "party-a",
    });
  });

  it("blocks an ordinary issuer member from marking a person inactive", async () => {
    mockAuthState.user = { user_id: "member-1" };
    const response = await request(app).post(
      "/v1/organizations/issuer/org-a/party-profiles/party-a/inactivate"
    );
    expect(response.status).toBe(403);
    expect(mockInactivateMasterParty).not.toHaveBeenCalled();
  });

  it("blocks an issuer from inactivating a person on another organization", async () => {
    mockAuthState.user = { user_id: "owner-1" };
    const response = await request(app).post(
      "/v1/organizations/issuer/org-b/party-profiles/party-a/inactivate"
    );
    expect(response.status).toBe(403);
    expect(mockInactivateMasterParty).not.toHaveBeenCalled();
  });

  it("keeps the existing admin inactivation route", async () => {
    mockAuthState.user = { user_id: "admin-staff" };
    const response = await request(app).post(
      "/v1/admin/organizations/issuer/org-a/party-profiles/party-a/inactivate"
    );
    expect(response.status).toBe(200);
    expect(mockGetOrganization).not.toHaveBeenCalled();
    expect(mockInactivateMasterParty).toHaveBeenCalledWith({
      portal: "issuer",
      organizationId: "org-a",
      partyId: "party-a",
    });
  });

  it("blocks admin inactivation without organizations.manage", async () => {
    mockAuthState.user = { user_id: "admin-staff" };
    mockAuthState.adminPermissions = ["organizations.view"];
    const response = await request(app).post(
      "/v1/admin/organizations/issuer/org-a/party-profiles/party-a/inactivate"
    );
    expect(response.status).toBe(403);
    expect(mockInactivateMasterParty).not.toHaveBeenCalled();
  });
});
