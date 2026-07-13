import { PrismaClient } from "@prisma/client";
import { ensureAdminRoleCatalog } from "./rbac";

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("admin RBAC catalog backfill", () => {
  const createdRoleIds: string[] = [];

  afterAll(async () => {
    if (createdRoleIds.length) {
      await prisma.adminRoleConfig.deleteMany({ where: { id: { in: createdRoleIds } } });
    }
    await prisma.$disconnect();
  });

  it("adds gateway reconciliation permissions based on existing gateway payment permissions", async () => {
    const suffix = `${Date.now()}`.slice(-6);

    const viewOnlyRole = await prisma.adminRoleConfig.create({
      data: {
        key: `TEST_GW_VIEW_${suffix}`,
        name: `Gateway View ${suffix}`,
        permissions: ["gateway_payments.view"],
        is_system: false,
        is_editable: true,
        is_default: false,
      },
    });
    createdRoleIds.push(viewOnlyRole.id);

    const manageRole = await prisma.adminRoleConfig.create({
      data: {
        key: `TEST_GW_MANAGE_${suffix}`,
        name: `Gateway Manage ${suffix}`,
        permissions: ["gateway_payments.view", "gateway_payments.manage"],
        is_system: false,
        is_editable: true,
        is_default: false,
      },
    });
    createdRoleIds.push(manageRole.id);

    await ensureAdminRoleCatalog(prisma);

    const viewOnlyUpdated = await prisma.adminRoleConfig.findUniqueOrThrow({
      where: { id: viewOnlyRole.id },
    });
    expect(viewOnlyUpdated.permissions).toEqual(
      expect.arrayContaining(["gateway_payments.view", "gateway_reconciliation.view"])
    );
    expect(viewOnlyUpdated.permissions).not.toContain("gateway_reconciliation.manage");
    expect(viewOnlyUpdated.permissions).not.toContain("gateway_payments.manage");

    const manageUpdated = await prisma.adminRoleConfig.findUniqueOrThrow({
      where: { id: manageRole.id },
    });
    expect(manageUpdated.permissions).toEqual(
      expect.arrayContaining([
        "gateway_payments.view",
        "gateway_payments.manage",
        "gateway_reconciliation.view",
        "gateway_reconciliation.manage",
      ])
    );
  });
});
