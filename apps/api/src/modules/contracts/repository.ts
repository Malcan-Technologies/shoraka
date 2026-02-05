import { prisma } from "../../lib/prisma";
import { Contract, Prisma, ContractStatus } from "@prisma/client";

export class ContractRepository {
  async create(data: {
    issuer_organization_id: string;
    status?: ContractStatus;
  }): Promise<Contract> {
    return prisma.contract.create({
      data: {
        issuer_organization_id: data.issuer_organization_id,
        status: data.status ?? "DRAFT",
      },
    });
  }

  async findById(id: string): Promise<Contract | null> {
    return prisma.contract.findUnique({
      where: { id },
      include: {
        applications: true,
        issuer_organization: true,
        invoices: true,
      },
    });
  }

  async findByApplicationId(applicationId: string): Promise<Contract | null> {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { contract: true }
    });
    return application?.contract ?? null;
  }

  async update(id: string, data: Prisma.ContractUpdateInput): Promise<Contract> {
    return prisma.contract.update({
      where: { id },
      data,
    });
  }

  async unlinkFromApplication(contractId: string, applicationId: string): Promise<void> {
    await prisma.application.update({
      where: { id: applicationId },
      data: { contract_id: null },
    });
  }

  async findApprovedByOrganization(organizationId: string): Promise<Contract[]> {
    // Return contracts that are either top-level APPROVED
    // or have status: "approved" in their contract_details JSON
    return prisma.contract.findMany({
      where: {
        issuer_organization_id: organizationId,
        status: "APPROVED",
      },
      orderBy: { created_at: "desc" },
    });
  }
}
