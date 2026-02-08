import { prisma } from "../../lib/prisma";
import { Invoice, Prisma } from "@prisma/client";

export class InvoiceRepository {
  async create(data: {
    application_id: string;
    contract_id?: string;
    details: Prisma.InputJsonValue;
  }): Promise<Invoice> {
    return prisma.invoice.create({
      data: {
        application_id: data.application_id,
        contract_id: data.contract_id,
        details: data.details,
      },
    });
  }

  async findById(id: string): Promise<Invoice | null> {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            issuer_organization: true,
          },
        },
        contract: true,
      },
    });
  }

  async update(id: string, data: Prisma.InvoiceUpdateInput): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.invoice.delete({
      where: { id },
    });
  }

  async findByApplicationId(applicationId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: { application_id: applicationId },
      orderBy: { created_at: "asc" },
    });
  }

  async findByContractId(contractId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: {
        contract_id: contractId,
        status: {
          in: ["SUBMITTED", "APPROVED"],
        },
      },
      orderBy: { created_at: "asc" },
    });
  }

  async updateStatus(id: string, status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id },
      data: { status },
    });
  }

  async updateManyStatus(ids: string[], status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"): Promise<void> {
    await prisma.invoice.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
  }
}

export const invoiceRepository = new InvoiceRepository();

