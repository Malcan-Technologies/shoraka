jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: { findUnique: jest.fn(), update: jest.fn() },
    investorOrganization: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("../onboarding/audit/writer", () => ({
  writeOnboardingAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { AUDIT_ACTOR_TYPE, AUDIT_PORTAL, AUDIT_SOURCE } from "../../lib/audit/context";
import { parseOnboardingAuditMetadata } from "../onboarding/audit/metadata";
import { writeOnboardingAuditLog } from "../onboarding/audit/writer";
import { updateAdminOrganizationProfile } from "./organization-admin-profile";

const adminContext = {
  actorType: AUDIT_ACTOR_TYPE.ADMIN,
  actorUserId: "admin-1",
  source: AUDIT_SOURCE.API,
  portal: AUDIT_PORTAL.ADMIN,
  ipAddress: "203.0.113.10",
  userAgent: "AdminAgent/1.0",
  correlationId: "corr-org-profile",
};

const orgRow = {
  id: "org-1",
  owner_user_id: "owner-1",
  name: "Acme",
  phone_number: "+60111111111",
  address: "1 Jalan Ampang",
  first_name: "Aisha",
  last_name: "Tan",
  middle_name: null as string | null,
  corporate_onboarding_data: { basicInfo: { website: "https://old.example" } },
  type: "COMPANY" as const,
};

describe("updateAdminOrganizationProfile audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ ...orgRow });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        issuerOrganization: { update: jest.fn().mockResolvedValue({}) },
        investorOrganization: { update: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  });

  it("writes ORGANIZATION_PROFILE_UPDATED_BY_ADMIN with admin actor, org target, and scalar metadata", async () => {
    await updateAdminOrganizationProfile({
      portal: "issuer",
      organizationId: "org-1",
      input: { name: "Acme Sdn Bhd" },
      context: adminContext,
    });

    expect(writeOnboardingAuditLog).toHaveBeenCalledTimes(1);
    const [input, tx] = (writeOnboardingAuditLog as jest.Mock).mock.calls[0];
    expect(tx).toBeDefined();
    expect(input.eventType).toBe("ORGANIZATION_PROFILE_UPDATED_BY_ADMIN");
    expect(input.context.actorType).toBe("ADMIN");
    expect(input.context.actorUserId).toBe("admin-1");
    expect(input.targetType).toBe("ORGANIZATION");
    expect(input.targetId).toBe("org-1");
    expect(input.organizationId).toBe("org-1");
    expect(input.organizationKind).toBe("ISSUER");
    expect(input.organizationType).toBe("COMPANY");
    expect(input.subjectUserId).toBe("owner-1");
    expect(input.metadata.changedFields).toEqual(["name"]);
    expect(input.metadata.before).toEqual({
      name: "Acme",
      phoneNumber: "+60111111111",
      address: "1 Jalan Ampang",
      firstName: "Aisha",
      lastName: "Tan",
      middleName: null,
    });
    expect(input.metadata.after.name).toBe("Acme Sdn Bhd");
    expect(input.metadata.bankAccountDetailsChanged).toBe(false);
    expect(input.metadata.corporateOnboardingChangedFields).toBeUndefined();
    expect(JSON.stringify(input.metadata)).not.toContain("1234567890");
  });

  it("skips audit on a true scalar no-op", async () => {
    await updateAdminOrganizationProfile({
      portal: "issuer",
      organizationId: "org-1",
      input: { name: "Acme" },
      context: adminContext,
    });
    expect(writeOnboardingAuditLog).not.toHaveBeenCalled();
  });

  it("treats bank payload presence as a change without storing account numbers", async () => {
    await updateAdminOrganizationProfile({
      portal: "issuer",
      organizationId: "org-1",
      input: {
        bankAccountDetails: {
          content: [
            { cn: false, fieldName: "Bank account number", fieldType: "text", fieldValue: "1234567890" },
          ],
          displayArea: "bank",
        },
      },
      context: adminContext,
    });

    expect(writeOnboardingAuditLog).toHaveBeenCalledTimes(1);
    const metadata = (writeOnboardingAuditLog as jest.Mock).mock.calls[0][0].metadata;
    expect(metadata.changedFields).toEqual(["bankAccountDetails"]);
    expect(metadata.bankAccountDetailsChanged).toBe(true);
    expect(JSON.stringify(metadata)).not.toContain("1234567890");
    expect(JSON.stringify(metadata)).not.toMatch(/bank account number/i);
  });

  it("writes corporate nested key names only", async () => {
    await updateAdminOrganizationProfile({
      portal: "issuer",
      organizationId: "org-1",
      input: { corporateOnboardingData: { website: "https://new.example", tinNumber: "C123" } },
      context: adminContext,
    });

    const metadata = (writeOnboardingAuditLog as jest.Mock).mock.calls[0][0].metadata;
    expect(metadata.changedFields).toEqual(["corporateOnboardingData"]);
    expect(metadata.corporateOnboardingChangedFields).toEqual(["website", "tinNumber"]);
    expect(JSON.stringify(metadata)).not.toContain("https://new.example");
    expect(JSON.stringify(metadata)).not.toContain("C123");
  });

  it("rolls back the transaction when the audit write throws", async () => {
    (writeOnboardingAuditLog as jest.Mock).mockRejectedValueOnce(new Error("audit failed"));
    let committed = false;
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
      try {
        const result = await fn({
          issuerOrganization: { update: jest.fn().mockResolvedValue({}) },
          investorOrganization: { update: jest.fn().mockResolvedValue({}) },
        });
        committed = true;
        return result;
      } catch (error) {
        committed = false;
        throw error;
      }
    });

    await expect(
      updateAdminOrganizationProfile({
        portal: "issuer",
        organizationId: "org-1",
        input: { name: "Changed" },
        context: adminContext,
      })
    ).rejects.toThrow("audit failed");
    expect(committed).toBe(false);
  });

  it("rejects an empty PATCH before opening a transaction", async () => {
    await expect(
      updateAdminOrganizationProfile({
        portal: "issuer",
        organizationId: "org-1",
        input: {},
        context: adminContext,
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(writeOnboardingAuditLog).not.toHaveBeenCalled();
  });
});

describe("ORGANIZATION_PROFILE_UPDATED_BY_ADMIN metadata schema", () => {
  it("parses writer-shaped metadata and rejects nested objects in before/after", () => {
    expect(
      parseOnboardingAuditMetadata("ORGANIZATION_PROFILE_UPDATED_BY_ADMIN", {
        actorName: "Ada",
        actorEmail: "ada@example.com",
        changedFields: ["name"],
        before: { name: "Acme", phoneNumber: null, address: null, firstName: null, lastName: null, middleName: null },
        after: { name: "Acme Sdn Bhd", phoneNumber: null, address: null, firstName: null, lastName: null, middleName: null },
        bankAccountDetailsChanged: false,
      })
    ).toMatchObject({ changedFields: ["name"], bankAccountDetailsChanged: false });

    expect(() =>
      parseOnboardingAuditMetadata("ORGANIZATION_PROFILE_UPDATED_BY_ADMIN", {
        actorName: null,
        actorEmail: null,
        changedFields: ["name"],
        before: { name: { nested: true } },
        after: { name: "x" },
        bankAccountDetailsChanged: false,
      })
    ).toThrow();
  });
});
