import { OrganizationType } from "@prisma/client";
import { patchOrgMasterProfile } from "./service";
import { prisma } from "../../lib/prisma";

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("master-profile provenance persistence (integration)", () => {
  const suffix = `${Date.now()}`.slice(-4); // must be <= 5 chars due to schema
  const userId = `u${suffix}`;
  const email = `investor-${suffix}@example.com`;
  const cognitoSub = `sub-${suffix}`;
  const cognitoUsername = `username-${suffix}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        user_id: userId,
        first_name: "Test",
        last_name: "Investor",
        email,
        cognito_sub: cognitoSub,
        cognito_username: cognitoUsername,
        roles: [],
        investor_account: [],
        issuer_account: [],
      },
    });
  });

  afterAll(async () => {
    await prisma.investorOrganization.deleteMany({ where: { owner_user_id: userId } });
    await prisma.user.deleteMany({ where: { user_id: userId } });
  });

  it("missing DOB: Investor can set and stamps USER", async () => {
    const orgId = `inv-org-dob-${suffix}`;
    await prisma.investorOrganization.create({
      data: {
        id: orgId,
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
        profile_field_sources: {
          dateOfBirth: { source: "REGTANK", updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString() },
        } as any,
        gender: "MALE",
        nationality: "MALAYSIA",
        date_of_birth: null,
        document_type: "DRIVER_LICENSE",
        document_number: null,
      },
    });

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: orgId,
      actorUserId: userId,
      source: "USER",
      fillEmptyOnly: true,
      patch: { dateOfBirth: "1991-01-01" },
    });

    const updated = await prisma.investorOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(updated.date_of_birth?.toISOString()).toBe(new Date("1991-01-01T00:00:00.000Z").toISOString());
    const sources = updated.profile_field_sources as any;
    expect(sources.dateOfBirth.source).toBe("USER");
  });

  it("USER-sourced identityNumber: Investor can overwrite and stamps USER", async () => {
    const orgId = `inv-org-idnum-user-${suffix}`;

    await prisma.investorOrganization.create({
      data: {
        id: orgId,
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
        profile_field_sources: {
          identityNumber: { source: "USER", updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString() },
        } as any,
        gender: "MALE",
        nationality: "MALAYSIA",
        date_of_birth: new Date("1990-01-01T00:00:00.000Z"),
        document_type: "DRIVER_LICENSE",
        document_number: "800101011234",
      },
    });

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId: orgId,
      actorUserId: userId,
      source: "USER",
      fillEmptyOnly: true,
      patch: { identityNumber: "800101011999" },
    });

    const updated = await prisma.investorOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(updated.document_number).toBe("800101011999");
    const sources = updated.profile_field_sources as any;
    expect(sources.identityNumber.source).toBe("USER");
  });

  it("REGTANK-sourced identityNumber: Investor cannot overwrite (provenance preserved)", async () => {
    const orgId = `inv-org-idnum-regtank-${suffix}`;

    await prisma.investorOrganization.create({
      data: {
        id: orgId,
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
        profile_field_sources: {
          identityNumber: { source: "REGTANK", updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString() },
        } as any,
        gender: "MALE",
        nationality: "MALAYSIA",
        date_of_birth: new Date("1990-01-01T00:00:00.000Z"),
        document_type: "DRIVER_LICENSE",
        document_number: "800101011234",
      },
    });

    await expect(
      patchOrgMasterProfile({
        portal: "investor",
        organizationId: orgId,
        actorUserId: userId,
        source: "USER",
        fillEmptyOnly: true,
        patch: { identityNumber: "800101011999" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });

    const updated = await prisma.investorOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(updated.document_number).toBe("800101011234");
    const sources = updated.profile_field_sources as any;
    expect(sources.identityNumber.source).toBe("REGTANK");
  });
});

