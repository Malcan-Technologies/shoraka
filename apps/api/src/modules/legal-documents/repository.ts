import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  CreateLegalDocumentInput,
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
  show_in_account: boolean;
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
        show_in_account: input.showInAccount ?? false,
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
        ...(input.showInAccount !== undefined && {
          show_in_account: input.showInAccount,
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
    input: {
      s3Key: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      fileHash: string;
    },
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
        file_hash: input.fileHash,
        uploaded_by: uploadedBy,
      },
      include: { legal_document: true },
    })) as VersionWithDocument;
  }

  async updateDraftVersion(versionId: string, _input: UpdateVersionInput) {
    // Client-supplied hashes are not authoritative; metadata patches no longer mutate file_hash.
    return (await prisma.legalDocumentVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { legal_document: true },
    })) as VersionWithDocument;
  }

  async replaceDraftFile(
    versionId: string,
    input: {
      s3Key: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      fileHash: string;
    }
  ) {
    return (await prisma.legalDocumentVersion.update({
      where: { id: versionId },
      data: {
        s3_key: input.s3Key,
        file_name: input.fileName,
        content_type: input.contentType,
        file_size: input.fileSize,
        file_hash: input.fileHash,
      },
      include: { legal_document: true },
    })) as VersionWithDocument;
  }

  async countVersionsByS3Key(s3Key: string, excludeVersionId?: string): Promise<number> {
    return prisma.legalDocumentVersion.count({
      where: {
        s3_key: s3Key,
        ...(excludeVersionId ? { id: { not: excludeVersionId } } : {}),
      },
    });
  }

  async listReferencedS3Keys(): Promise<string[]> {
    const rows = await prisma.legalDocumentVersion.findMany({
      select: { s3_key: true },
    });
    return rows.map((row) => row.s3_key);
  }

  async publishVersion(
    versionId: string,
    legalDocumentId: string,
    publishedBy: string,
    reacceptanceRequired: boolean
  ) {
    return prisma.$transaction(async (tx) => {
      // Serialize publish/restore/archive against the same definition.
      await tx.$queryRaw`
        SELECT id FROM legal_documents WHERE id = ${legalDocumentId} FOR UPDATE
      `;

      // Only one active Published version may exist. Archive every other Published row.
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

      const published = (await tx.legalDocumentVersion.update({
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

      const activeCount = await tx.legalDocumentVersion.count({
        where: {
          legal_document_id: legalDocumentId,
          status: "PUBLISHED",
        },
      });
      if (activeCount !== 1) {
        throw new Error(
          `Publish integrity failed: expected exactly 1 PUBLISHED version, found ${activeCount}`
        );
      }

      return published;
    });
  }

  async archiveVersion(versionId: string, archivedBy: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.legalDocumentVersion.findUnique({
        where: { id: versionId },
        select: { legal_document_id: true, status: true },
      });
      if (!existing) {
        throw new Error("Legal document version not found");
      }

      await tx.$queryRaw`
        SELECT id FROM legal_documents WHERE id = ${existing.legal_document_id} FOR UPDATE
      `;

      return (await tx.legalDocumentVersion.update({
        where: { id: versionId },
        data: {
          status: "ARCHIVED",
          archived_by: archivedBy,
          archived_at: new Date(),
        },
        include: { legal_document: true },
      })) as VersionWithDocument;
    });
  }

  async findDraftByDocumentId(legalDocumentId: string) {
    return (await prisma.legalDocumentVersion.findFirst({
      where: {
        legal_document_id: legalDocumentId,
        status: "DRAFT",
      },
      include: { legal_document: true },
      orderBy: { version: "desc" },
    })) as VersionWithDocument | null;
  }

  async findPublishedByDocumentId(legalDocumentId: string) {
    return (await prisma.legalDocumentVersion.findFirst({
      where: {
        legal_document_id: legalDocumentId,
        status: "PUBLISHED",
      },
      include: { legal_document: true },
      orderBy: { version: "desc" },
    })) as VersionWithDocument | null;
  }

  async restoreVersionToDraft(versionId: string) {
    return (await prisma.legalDocumentVersion.update({
      where: { id: versionId },
      data: {
        status: "DRAFT",
        archived_by: null,
        archived_at: null,
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

  /** Published versions flagged for Profile → Documents for the given audiences. */
  async findAccountPublishedVersions(
    audiences: Array<"PUBLIC" | "ISSUER" | "INVESTOR" | "BOTH">
  ) {
    return (await prisma.legalDocumentVersion.findMany({
      where: {
        status: "PUBLISHED",
        legal_document: {
          show_in_account: true,
          audience: { in: audiences },
        },
      },
      include: { legal_document: true },
      orderBy: [{ legal_document: { type: "asc" } }, { version: "desc" }],
    })) as VersionWithDocument[];
  }
}

export const legalDocumentRepository = new LegalDocumentRepository();
