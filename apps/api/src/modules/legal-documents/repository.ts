import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  CreateLegalDocumentInput,
  CreateVersionInput,
  ListLegalDocumentsQuery,
  LegalDocumentTypeValue,
  UpdateLegalDocumentInput,
  UpdateVersionInput,
} from "./schemas";

export type LegalDocumentRow = {
  id: string;
  type: LegalDocumentTypeValue;
  title: string;
  description: string | null;
  audience: "PUBLIC" | "ISSUER" | "INVESTOR" | "BOTH";
  required_for_onboarding: boolean;
  public_visibility: boolean;
  created_at: Date;
  updated_at: Date;
};

export type LegalDocumentVersionRow = {
  id: string;
  legal_document_id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  s3_key: string;
  file_name: string;
  content_type: string;
  file_size: number;
  file_hash: string | null;
  reacceptance_required: boolean;
  uploaded_by: string;
  published_by: string | null;
  published_at: Date | null;
  archived_by: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type LegalDocumentWithVersions = LegalDocumentRow & {
  versions: LegalDocumentVersionRow[];
};

export type VersionWithDocument = LegalDocumentVersionRow & {
  legal_document: LegalDocumentRow;
};

export class LegalDocumentRepository {
  async findAll(query: ListLegalDocumentsQuery) {
    const { page, pageSize, type, audience, search } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.LegalDocumentWhereInput = {};
    if (type) where.type = type;
    if (audience) where.audience = audience;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.legalDocument.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          versions: {
            orderBy: { version: "desc" },
          },
        },
      }),
      prisma.legalDocument.count({ where }),
    ]);

    return {
      documents: documents as LegalDocumentWithVersions[],
      total,
    };
  }

  async findById(id: string) {
    return (await prisma.legalDocument.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: "desc" } },
      },
    })) as LegalDocumentWithVersions | null;
  }

  async findByType(type: LegalDocumentTypeValue) {
    return (await prisma.legalDocument.findUnique({
      where: { type },
    })) as LegalDocumentRow | null;
  }

  async create(input: CreateLegalDocumentInput) {
    return (await prisma.legalDocument.create({
      data: {
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        audience: input.audience,
        required_for_onboarding: input.requiredForOnboarding ?? true,
        public_visibility: input.publicVisibility ?? false,
      },
      include: {
        versions: true,
      },
    })) as LegalDocumentWithVersions;
  }

  async update(id: string, input: UpdateLegalDocumentInput) {
    return (await prisma.legalDocument.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.audience !== undefined && { audience: input.audience }),
        ...(input.requiredForOnboarding !== undefined && {
          required_for_onboarding: input.requiredForOnboarding,
        }),
        ...(input.publicVisibility !== undefined && {
          public_visibility: input.publicVisibility,
        }),
      },
      include: {
        versions: { orderBy: { version: "desc" } },
      },
    })) as LegalDocumentWithVersions;
  }

  async getLatestVersionNumber(legalDocumentId: string): Promise<number> {
    const latest = await prisma.legalDocumentVersion.findFirst({
      where: { legal_document_id: legalDocumentId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  async findVersionById(versionId: string) {
    return (await prisma.legalDocumentVersion.findUnique({
      where: { id: versionId },
      include: { legal_document: true },
    })) as VersionWithDocument | null;
  }

  async createVersion(
    legalDocumentId: string,
    version: number,
    input: CreateVersionInput,
    uploadedBy: string
  ) {
    return (await prisma.legalDocumentVersion.create({
      data: {
        legal_document_id: legalDocumentId,
        version,
        status: "DRAFT",
        s3_key: input.s3Key,
        file_name: input.fileName,
        content_type: input.contentType,
        file_size: input.fileSize,
        file_hash: input.fileHash ?? null,
        uploaded_by: uploadedBy,
      },
      include: { legal_document: true },
    })) as VersionWithDocument;
  }

  async updateDraftVersion(versionId: string, input: UpdateVersionInput) {
    return (await prisma.legalDocumentVersion.update({
      where: { id: versionId },
      data: {
        ...(input.fileHash !== undefined && { file_hash: input.fileHash }),
      },
      include: { legal_document: true },
    })) as VersionWithDocument;
  }

  async publishVersion(
    versionId: string,
    legalDocumentId: string,
    publishedBy: string,
    reacceptanceRequired: boolean
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.legalDocumentVersion.updateMany({
        where: {
          legal_document_id: legalDocumentId,
          status: "PUBLISHED",
          id: { not: versionId },
        },
        data: {
          status: "ARCHIVED",
          archived_by: publishedBy,
          archived_at: new Date(),
        },
      });

      return (await tx.legalDocumentVersion.update({
        where: { id: versionId },
        data: {
          status: "PUBLISHED",
          reacceptance_required: reacceptanceRequired,
          published_by: publishedBy,
          published_at: new Date(),
          archived_by: null,
          archived_at: null,
        },
        include: { legal_document: true },
      })) as VersionWithDocument;
    });
  }

  async archiveVersion(versionId: string, archivedBy: string) {
    return (await prisma.legalDocumentVersion.update({
      where: { id: versionId },
      data: {
        status: "ARCHIVED",
        archived_by: archivedBy,
        archived_at: new Date(),
      },
      include: { legal_document: true },
    })) as VersionWithDocument;
  }

  async findPublishedByTypeAndAudiences(
    type: LegalDocumentTypeValue,
    audiences: Array<"PUBLIC" | "ISSUER" | "INVESTOR" | "BOTH">
  ) {
    return (await prisma.legalDocumentVersion.findFirst({
      where: {
        status: "PUBLISHED",
        legal_document: {
          type,
          audience: { in: audiences },
          required_for_onboarding: true,
        },
      },
      include: { legal_document: true },
      orderBy: { version: "desc" },
    })) as VersionWithDocument | null;
  }

  async findPublishedReacceptanceByTypeAndAudiences(
    type: LegalDocumentTypeValue,
    audiences: Array<"PUBLIC" | "ISSUER" | "INVESTOR" | "BOTH">
  ) {
    return (await prisma.legalDocumentVersion.findFirst({
      where: {
        status: "PUBLISHED",
        reacceptance_required: true,
        legal_document: {
          type,
          audience: { in: audiences },
          required_for_onboarding: true,
        },
      },
      include: { legal_document: true },
      orderBy: { version: "desc" },
    })) as VersionWithDocument | null;
  }

  async findPublicPublishedVersions() {
    return (await prisma.legalDocumentVersion.findMany({
      where: {
        status: "PUBLISHED",
        legal_document: {
          public_visibility: true,
        },
      },
      include: { legal_document: true },
      orderBy: [{ legal_document: { type: "asc" } }, { version: "desc" }],
    })) as VersionWithDocument[];
  }

  async findPublicPublishedByType(type: string) {
    return (await prisma.legalDocumentVersion.findFirst({
      where: {
        status: "PUBLISHED",
        legal_document: {
          type: type as never,
          public_visibility: true,
        },
      },
      include: { legal_document: true },
      orderBy: { version: "desc" },
    })) as VersionWithDocument | null;
  }
}

export const legalDocumentRepository = new LegalDocumentRepository();
