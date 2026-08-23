import type { Request } from "express";
import { OrganizationMemberRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

type PortalType = "investor" | "issuer";

type InvitationRow = {
  id: string;
  email: string;
  role: OrganizationMemberRole;
  investor_organization_id?: string;
  issuer_organization_id?: string;
  token: string;
  expires_at: Date;
  accepted: boolean;
  accepted_at: Date | null;
  invited_by_user_id: string;
  created_at: Date;
};

const auditWrites: Array<{
  eventType: string;
  context: { correlationId: string | null };
  metadata: Record<string, unknown>;
  targetId: string;
}> = [];

const investorInvitations: InvitationRow[] = [];
const issuerInvitations: InvitationRow[] = [];
let nextInvitationId = 1;
let sendEmailImpl: () => Promise<{ messageId: string }> = async () => ({ messageId: "msg-1" });

const OWNER_ID = "owner_1";
const ORG_NAME = "ABC SDN BHD";
const MEMBER_EMAIL = "user@example.com";

function storeFor(portal: PortalType): InvitationRow[] {
  return portal === "investor" ? investorInvitations : issuerInvitations;
}

function orgIdFor(portal: PortalType): string {
  return portal === "investor" ? "inv_org_1" : "iss_org_1";
}

function orgKeyFor(portal: PortalType): "investor_organization_id" | "issuer_organization_id" {
  return portal === "investor" ? "investor_organization_id" : "issuer_organization_id";
}

function makeInvitationDelegate(portal: PortalType) {
  const orgKey = orgKeyFor(portal);
  return {
    findFirst: jest.fn(async ({
      where,
      orderBy,
    }: {
      where: Record<string, unknown>;
      orderBy?: { created_at?: string };
    }) => {
      let rows = storeFor(portal).filter((row) => {
        if (where.email !== undefined && row.email !== where.email) return false;
        if (where.role !== undefined && row.role !== where.role) return false;
        if (where.accepted !== undefined && row.accepted !== where.accepted) return false;
        if (where[orgKey] !== undefined && row[orgKey] !== where[orgKey]) return false;
        const expiresAt = where.expires_at as { gt?: Date } | undefined;
        if (expiresAt?.gt && !(row.expires_at > expiresAt.gt)) return false;
        return true;
      });
      if (orderBy?.created_at === "desc") {
        rows = [...rows].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      }
      return rows[0] ?? null;
    }),
    create: jest.fn(async ({ data }: { data: Partial<InvitationRow> }) => {
      const row: InvitationRow = {
        id: `inv-${portal}-${nextInvitationId++}`,
        email: data.email as string,
        role: data.role as OrganizationMemberRole,
        token: data.token as string,
        expires_at: data.expires_at as Date,
        invited_by_user_id: data.invited_by_user_id as string,
        accepted: false,
        accepted_at: null,
        created_at: new Date(),
        [orgKey]: data[orgKey] as string,
      };
      storeFor(portal).push(row);
      return row;
    }),
    findUnique: jest.fn(async ({
      where,
      include,
    }: {
      where: { id?: string; token?: string };
      include?: { investor_organization?: unknown; issuer_organization?: unknown; invited_by?: unknown };
    }) => {
      const row =
        storeFor(portal).find((r) => r.id === where.id || r.token === where.token) ?? null;
      if (!row) return null;
      return {
        ...row,
        investor_organization: include?.investor_organization ? { name: ORG_NAME } : undefined,
        issuer_organization: include?.issuer_organization ? { name: ORG_NAME } : undefined,
        invited_by: include?.invited_by ? { first_name: "Aisha", last_name: "Rahman" } : undefined,
      };
    }),
    delete: jest.fn(async ({ where }: { where: { id: string } }) => {
      const rows = storeFor(portal);
      const idx = rows.findIndex((r) => r.id === where.id);
      if (idx >= 0) rows.splice(idx, 1);
    }),
    update: jest.fn(async ({
      where,
      data,
    }: {
      where: { id?: string; token?: string };
      data: Partial<InvitationRow>;
    }) => {
      const row = storeFor(portal).find((r) => r.id === where.id || r.token === where.token);
      if (!row) return null;
      Object.assign(row, data);
      return row;
    }),
  };
}

const mockPrisma: {
  investorOrganizationInvitation: ReturnType<typeof makeInvitationDelegate>;
  issuerOrganizationInvitation: ReturnType<typeof makeInvitationDelegate>;
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
} = {
  investorOrganizationInvitation: makeInvitationDelegate("investor"),
  issuerOrganizationInvitation: makeInvitationDelegate("issuer"),
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma)),
};

const mockRepository = {
  findInvestorOrganizationById: jest.fn(),
  findIssuerOrganizationById: jest.fn(),
  findUserByEmail: jest.fn(),
  isInvestorOrganizationMember: jest.fn(),
  isIssuerOrganizationMember: jest.fn(),
  findInvitationByToken: jest.fn(),
  addOrganizationMember: jest.fn(),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("./repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => mockRepository),
}));

jest.mock("../../lib/email/ses-client", () => ({
  sendEmail: jest.fn(async () => sendEmailImpl()),
}));

jest.mock("../security/audit/writer", () => ({
  writeSecurityAuditLog: jest.fn(async (input: (typeof auditWrites)[number]) => {
    auditWrites.push(input);
  }),
}));

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  AdminUpdateUserAttributesCommand: jest.fn(),
}));

import { sendEmail } from "../../lib/email/ses-client";
import { writeSecurityAuditLog } from "../security/audit/writer";
import { OrganizationService } from "./service";

function makeReq(correlationId: string): Request {
  return {
    headers: { "user-agent": "jest" },
    ip: "127.0.0.1",
    user: { user_id: OWNER_ID, roles: [] },
    res: { locals: { correlationId } },
  } as unknown as Request;
}

function orgRecord(portal: PortalType) {
  return {
    id: orgIdFor(portal),
    name: ORG_NAME,
    owner_user_id: OWNER_ID,
    members: [{ user_id: OWNER_ID, role: OrganizationMemberRole.ORGANIZATION_ADMIN }],
  };
}

const portals: PortalType[] = ["issuer", "investor"];

describe("OrganizationService invitation reuse (issuer and investor)", () => {
  const service = new OrganizationService();

  beforeEach(() => {
    auditWrites.length = 0;
    investorInvitations.length = 0;
    issuerInvitations.length = 0;
    nextInvitationId = 1;
    sendEmailImpl = async () => ({ messageId: "msg-1" });
    jest.clearAllMocks();

    mockRepository.findInvestorOrganizationById.mockImplementation(async (id: string) =>
      id === orgIdFor("investor") ? orgRecord("investor") : null
    );
    mockRepository.findIssuerOrganizationById.mockImplementation(async (id: string) =>
      id === orgIdFor("issuer") ? orgRecord("issuer") : null
    );
    mockRepository.findUserByEmail.mockResolvedValue(null);
    mockRepository.isInvestorOrganizationMember.mockResolvedValue(false);
    mockRepository.isIssuerOrganizationMember.mockResolvedValue(false);
    mockRepository.findInvitationByToken.mockResolvedValue(null);
    mockRepository.addOrganizationMember.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      user_id: OWNER_ID,
      email: "owner@cashsouk.com",
      first_name: "Aisha",
      last_name: "Rahman",
    });
  });

  async function invite(
    portal: PortalType,
    role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER",
    correlationId: string,
    email = MEMBER_EMAIL
  ) {
    return service.inviteMember(
      OWNER_ID,
      orgIdFor(portal),
      portal,
      { email, role },
      makeReq(correlationId)
    );
  }

  describe.each(portals)("%s", (portal) => {
    it("creates a fresh MEMBER invite and writes ORGANIZATION_MEMBER_INVITED", async () => {
      const result = await invite(portal, "ORGANIZATION_MEMBER", "corr-create");

      expect(result.emailSent).toBe(true);
      expect(storeFor(portal)).toHaveLength(1);
      expect(storeFor(portal)[0].role).toBe(OrganizationMemberRole.ORGANIZATION_MEMBER);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(auditWrites.map((row) => row.eventType)).toEqual(["ORGANIZATION_MEMBER_INVITED"]);
      expect(auditWrites[0]).toEqual(
        expect.objectContaining({
          eventType: "ORGANIZATION_MEMBER_INVITED",
          targetId: result.invitationId,
          context: expect.objectContaining({ correlationId: "corr-create" }),
          metadata: expect.objectContaining({
            invitationId: result.invitationId,
            email: MEMBER_EMAIL,
            role: OrganizationMemberRole.ORGANIZATION_MEMBER,
          }),
        })
      );
    });

    it("reuses same-email same-role pending invite and writes ORGANIZATION_INVITATION_RESENT", async () => {
      const first = await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      const existing = storeFor(portal)[0];
      const token = existing.token;
      const expiresAt = existing.expires_at;

      const second = await invite(portal, "ORGANIZATION_MEMBER", "corr-reuse");

      expect(second.invitationId).toBe(first.invitationId);
      expect(storeFor(portal)).toHaveLength(1);
      expect(storeFor(portal)[0].id).toBe(existing.id);
      expect(storeFor(portal)[0].token).toBe(token);
      expect(storeFor(portal)[0].expires_at).toBe(expiresAt);
      expect(sendEmail).toHaveBeenCalledTimes(2);
      expect(auditWrites.map((row) => row.eventType)).toEqual([
        "ORGANIZATION_MEMBER_INVITED",
        "ORGANIZATION_INVITATION_RESENT",
      ]);
      expect(auditWrites[1]).toEqual(
        expect.objectContaining({
          eventType: "ORGANIZATION_INVITATION_RESENT",
          targetId: existing.id,
          context: expect.objectContaining({ correlationId: "corr-reuse" }),
          metadata: expect.objectContaining({
            invitationId: existing.id,
            email: MEMBER_EMAIL,
            role: OrganizationMemberRole.ORGANIZATION_MEMBER,
            expiresAt: expiresAt.toISOString(),
          }),
        })
      );
    });

    it("creates a new invitation for the same email with a different role", async () => {
      await invite(portal, "ORGANIZATION_MEMBER", "corr-member");
      const memberInvite = storeFor(portal)[0];

      const adminInvite = await invite(portal, "ORGANIZATION_ADMIN", "corr-admin");

      expect(storeFor(portal)).toHaveLength(2);
      expect(adminInvite.invitationId).not.toBe(memberInvite.id);
      expect(storeFor(portal)[0].id).toBe(memberInvite.id);
      expect(storeFor(portal)[0].role).toBe(OrganizationMemberRole.ORGANIZATION_MEMBER);
      expect(auditWrites.map((row) => row.eventType)).toEqual([
        "ORGANIZATION_MEMBER_INVITED",
        "ORGANIZATION_MEMBER_INVITED",
      ]);
      expect(auditWrites[1].targetId).toBe(adminInvite.invitationId);
    });

    it("does not reuse a revoked same-role invitation", async () => {
      const first = await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      await service.revokeInvitation(
        OWNER_ID,
        orgIdFor(portal),
        portal,
        first.invitationId,
        makeReq("corr-revoke")
      );
      expect(storeFor(portal)).toHaveLength(0);

      const second = await invite(portal, "ORGANIZATION_MEMBER", "corr-new");

      expect(storeFor(portal)).toHaveLength(1);
      expect(second.invitationId).not.toBe(first.invitationId);
      expect(auditWrites.map((row) => row.eventType)).toEqual([
        "ORGANIZATION_MEMBER_INVITED",
        "ORGANIZATION_INVITATION_REVOKED",
        "ORGANIZATION_MEMBER_INVITED",
      ]);
    });

    it("does not reuse an expired same-role invitation", async () => {
      const first = await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      storeFor(portal)[0].expires_at = new Date("2000-01-01T00:00:00.000Z");

      const second = await invite(portal, "ORGANIZATION_MEMBER", "corr-expired");

      expect(storeFor(portal)).toHaveLength(2);
      expect(second.invitationId).not.toBe(first.invitationId);
      expect(auditWrites.map((row) => row.eventType)).toEqual([
        "ORGANIZATION_MEMBER_INVITED",
        "ORGANIZATION_MEMBER_INVITED",
      ]);
    });

    it("does not reuse an already accepted same-role invitation", async () => {
      const first = await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      storeFor(portal)[0].accepted = true;
      storeFor(portal)[0].accepted_at = new Date();

      const second = await invite(portal, "ORGANIZATION_MEMBER", "corr-accepted");

      expect(storeFor(portal)).toHaveLength(2);
      expect(second.invitationId).not.toBe(first.invitationId);
      expect(auditWrites.map((row) => row.eventType)).toEqual([
        "ORGANIZATION_MEMBER_INVITED",
        "ORGANIZATION_MEMBER_INVITED",
      ]);
    });

    it("reuses the newest valid matching row and leaves older historical duplicates", async () => {
      await invite(portal, "ORGANIZATION_MEMBER", "corr-old");
      storeFor(portal)[0].created_at = new Date("2026-01-01T00:00:00.000Z");
      const older = { ...storeFor(portal)[0] };

      const newer: InvitationRow = {
        ...older,
        id: `inv-${portal}-historical-newer`,
        token: "token-newer-historical",
        created_at: new Date("2026-08-01T00:00:00.000Z"),
        expires_at: new Date("2099-01-01T00:00:00.000Z"),
      };
      storeFor(portal).push(newer);

      const result = await invite(portal, "ORGANIZATION_MEMBER", "corr-dup");

      expect(result.invitationId).toBe(newer.id);
      expect(storeFor(portal)).toHaveLength(2);
      expect(storeFor(portal).map((row) => row.id).sort()).toEqual([older.id, newer.id].sort());
      expect(auditWrites[auditWrites.length - 1].eventType).toBe("ORGANIZATION_INVITATION_RESENT");
      expect(auditWrites[auditWrites.length - 1].targetId).toBe(newer.id);
    });

    it("keeps explicit Resend writing ORGANIZATION_INVITATION_RESENT after email success", async () => {
      const created = await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      const existing = storeFor(portal)[0];

      const resent = await service.resendInvitation(
        OWNER_ID,
        orgIdFor(portal),
        portal,
        created.invitationId,
        makeReq("corr-explicit-resend")
      );

      expect(resent.emailSent).toBe(true);
      expect(storeFor(portal)).toHaveLength(1);
      expect(storeFor(portal)[0].token).toBe(existing.token);
      expect(storeFor(portal)[0].expires_at).toBe(existing.expires_at);
      expect(auditWrites.map((row) => row.eventType)).toEqual([
        "ORGANIZATION_MEMBER_INVITED",
        "ORGANIZATION_INVITATION_RESENT",
      ]);
      expect(auditWrites[1].context.correlationId).toBe("corr-explicit-resend");
      expect(auditWrites[1].metadata).toEqual(
        expect.objectContaining({
          invitationId: existing.id,
          email: MEMBER_EMAIL,
          role: OrganizationMemberRole.ORGANIZATION_MEMBER,
          expiresAt: existing.expires_at.toISOString(),
        })
      );
    });

    it("does not write ORGANIZATION_INVITATION_RESENT when reused-invite email send fails", async () => {
      await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      const existing = storeFor(portal)[0];
      const token = existing.token;
      const expiresAt = existing.expires_at;
      sendEmailImpl = async () => {
        throw new Error("SES unavailable");
      };

      const result = await invite(portal, "ORGANIZATION_MEMBER", "corr-fail");

      expect(result.emailSent).toBe(false);
      expect(result.emailError).toBe("SES unavailable");
      expect(result.invitationId).toBe(existing.id);
      expect(storeFor(portal)).toHaveLength(1);
      expect(storeFor(portal)[0].token).toBe(token);
      expect(storeFor(portal)[0].expires_at).toBe(expiresAt);
      expect(auditWrites.map((row) => row.eventType)).toEqual(["ORGANIZATION_MEMBER_INVITED"]);
    });

    it("Copy Link reuse does not write a Security audit row", async () => {
      await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      auditWrites.length = 0;
      (writeSecurityAuditLog as jest.Mock).mockClear();
      const existing = storeFor(portal)[0];

      const copied = await service.generateMemberInvitationUrl(
        OWNER_ID,
        orgIdFor(portal),
        portal,
        { email: MEMBER_EMAIL, role: "ORGANIZATION_MEMBER" },
        makeReq("corr-copy")
      );

      expect(copied.token).toBe(existing.token);
      expect(storeFor(portal)).toHaveLength(1);
      expect(auditWrites).toHaveLength(0);
      expect(writeSecurityAuditLog).not.toHaveBeenCalled();
    });

    it("acceptance still marks the invitation accepted and writes ORGANIZATION_MEMBER_JOINED", async () => {
      const created = await invite(portal, "ORGANIZATION_MEMBER", "corr-create");
      const existing = storeFor(portal)[0];
      mockPrisma.user.findUnique.mockResolvedValue({
        user_id: "invitee_1",
        email: MEMBER_EMAIL,
      });
      mockRepository.findInvitationByToken.mockResolvedValue({
        id: existing.id,
        email: existing.email,
        role: existing.role,
        investor_organization_id: portal === "investor" ? orgIdFor(portal) : null,
        issuer_organization_id: portal === "issuer" ? orgIdFor(portal) : null,
        expires_at: existing.expires_at,
        accepted: false,
      });

      const accepted = await service.acceptInvitation(
        "invitee_1",
        { token: existing.token },
        makeReq("corr-accept")
      );

      expect(accepted).toEqual({
        success: true,
        organizationId: orgIdFor(portal),
        portalType: portal,
      });
      expect(storeFor(portal)[0].accepted).toBe(true);
      expect(mockRepository.addOrganizationMember).toHaveBeenCalled();
      expect(auditWrites.map((row) => row.eventType)).toEqual([
        "ORGANIZATION_MEMBER_INVITED",
        "ORGANIZATION_MEMBER_JOINED",
      ]);
      expect(created.invitationId).toBe(existing.id);
    });

    it("acceptance of an already-accepted invitation is unchanged", async () => {
      mockRepository.findInvitationByToken.mockResolvedValue({
        id: "inv-accepted",
        email: MEMBER_EMAIL,
        role: OrganizationMemberRole.ORGANIZATION_MEMBER,
        investor_organization_id: portal === "investor" ? orgIdFor(portal) : null,
        issuer_organization_id: portal === "issuer" ? orgIdFor(portal) : null,
        expires_at: new Date("2099-01-01T00:00:00.000Z"),
        accepted: true,
      });

      await expect(
        service.acceptInvitation("invitee_1", { token: "tok" }, makeReq("corr-accept-dup"))
      ).rejects.toMatchObject({ code: "ALREADY_ACCEPTED" } satisfies Partial<AppError>);
      expect(mockRepository.addOrganizationMember).not.toHaveBeenCalled();
    });
  });
});
