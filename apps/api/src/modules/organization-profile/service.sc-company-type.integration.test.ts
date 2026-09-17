import { OrganizationType } from "@prisma/client";
import { patchOrgMasterProfile } from "./service";
import { prisma } from "../../lib/prisma";

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("scCompanyType saved for corporate investor (real prisma)", () => {
  const suffix = `${Date.now()}`.slice(-4);
  const userId = `u${suffix}`; // must be <= 5 chars due to schema
  const email = `inv-${suffix}@example.com`;
  const cognitoSub = `sub-${suffix}`;
  const cognitoUsername = `username-${suffix}`;
  const organizationId = `inv-org-${suffix}`;

  afterAll(async () => {
    // Clean up by user delete (cascades investor_organizations).
    await prisma.user.deleteMany({ where: { user_id: userId } });
  });

  it("saves scCompanyType via patchOrgMasterProfile() for corporate investor", async () => {
    await prisma.user.create({
      data: {
        user_id: userId,
        first_name: "Test",
        last_name: "Investor",
        email,
        cognito_sub: cognitoSub,
        cognito_username: cognitoUsername,
        roles: [],
        // Arrays have defaults in the schema, but keep them explicit for clarity.
        investor_account: [],
        issuer_account: [],
      },
    });

    await prisma.investorOrganization.create({
      data: {
        id: organizationId,
        owner_user_id: userId,
        type: OrganizationType.COMPANY,
        profile_field_sources: {},
      },
    });

    await patchOrgMasterProfile({
      portal: "investor",
      organizationId,
      actorUserId: userId,
      source: "ADMIN",
      patch: { scCompanyType: "LLP" },
    });

    const updated = await prisma.investorOrganization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    expect(updated.sc_company_type).toBe("LLP");

    const sources = updated.profile_field_sources as unknown as Record<
      string,
      { source: string }
    >;
    expect(sources.scCompanyType?.source).toBe("ADMIN");
  });
});

