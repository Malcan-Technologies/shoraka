import { prisma } from "../../lib/prisma";
import { Application, Prisma } from "@prisma/client";

export class ApplicationRepository {
  /**
   * Create a new application
   */
  async create(data: {
    issuer_organization_id: string;
    product_version: number;
    financing_type?: Prisma.InputJsonValue;
  }): Promise<Application> {
    return prisma.application.create({
      data: {
        issuer_organization_id: data.issuer_organization_id,
        product_version: data.product_version,
        financing_type: data.financing_type ?? Prisma.JsonNull,
        status: "DRAFT",
        last_completed_step: 1,
      },
    });
  }

  /**
   * Find application by ID
   */
  async findById(id: string): Promise<Application | null> {
    return prisma.application.findUnique({
      where: { id },
      include: {
        issuer_organization: true,
      },
    });
  }

  /**
   * Update application data
   */
  async update(id: string, data: Prisma.ApplicationUpdateInput): Promise<Application> {
    return prisma.application.update({
      where: { id },
      data,
    });
  }

  /**
   * List applications for an organization
   */
  async listByOrganization(organizationId: string): Promise<Application[]> {
    return prisma.application.findMany({
      where: { issuer_organization_id: organizationId },
      orderBy: { created_at: "desc" },
    });
  }
}
