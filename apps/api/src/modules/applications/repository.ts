import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { ApplicationStatus } from "./schemas";

export class NoteApplicationRepository {
  async create(data: {
    issuerOrganizationId: string;
  }) {
    return prisma.noteApplication.create({
      data: {
        issuer_organization_id: data.issuerOrganizationId,
        status: "DRAFT",
        last_completed_step: 0,
      },
    });
  }

  async findById(id: string) {
    return prisma.noteApplication.findUnique({
      where: { id },
      include: {
        issuer_organization: {
          include: {
            owner: {
              select: {
                user_id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: {
    financingType?: Prisma.InputJsonValue | null;
    financingTerms?: Prisma.InputJsonValue | null;
    invoiceDetails?: Prisma.InputJsonValue | null;
    companyInfo?: Prisma.InputJsonValue | null;
    supportingDocuments?: Prisma.InputJsonValue | null;
    declaration?: Prisma.InputJsonValue | null;
    lastCompletedStep?: number;
    status?: ApplicationStatus;
    submittedAt?: Date | null;
    approvedAt?: Date | null;
    rejectedAt?: Date | null;
    rejectionReason?: string | null;
  }) {
    return prisma.noteApplication.update({
      where: { id },
      data: {
        financing_type: data.financingType !== undefined ? data.financingType : undefined,
        financing_terms: data.financingTerms !== undefined ? data.financingTerms : undefined,
        invoice_details: data.invoiceDetails !== undefined ? data.invoiceDetails : undefined,
        company_info: data.companyInfo !== undefined ? data.companyInfo : undefined,
        supporting_documents: data.supportingDocuments !== undefined ? data.supportingDocuments : undefined,
        declaration: data.declaration !== undefined ? data.declaration : undefined,
        last_completed_step: data.lastCompletedStep !== undefined ? data.lastCompletedStep : undefined,
        status: data.status,
        submitted_at: data.submittedAt,
        approved_at: data.approvedAt,
        rejected_at: data.rejectedAt,
        rejection_reason: data.rejectionReason,
      },
    });
  }

  async findByOrganizationId(issuerOrganizationId: string) {
    return prisma.noteApplication.findMany({
      where: {
        issuer_organization_id: issuerOrganizationId,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }
}
