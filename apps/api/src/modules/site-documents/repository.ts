import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  DocumentEventType,
  GetDocumentLogsQuery,
  SiteDocumentType,
} from "./schemas";
import type { LegalDocumentAudience, LegalDocumentStatus } from "@cashsouk/types";

type SiteDocumentRow = {
  id: string;
  type: SiteDocumentType;
  title: string;
  description: string | null;
  file_name: string;
  s3_key: string;
  content_type: string;
  file_size: number;
  file_hash: string | null;
  version: number;
  is_active: boolean;
  show_in_account: boolean;
  audience: LegalDocumentAudience;
  status: LegalDocumentStatus;
  effective_date: Date | null;
  acceptance_required: boolean;
  open_before_accept_required: boolean;
  reacceptance_required: boolean;
  uploaded_by: string;
  published_by: string | null;
  published_at: Date | null;
  archived_by: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type PrismaClientWithDocs = typeof prisma & {
  siteDocument: {
    findMany: (args: unknown) => Promise<SiteDocumentRow[]>;
    findUnique: (args: unknown) => Promise<SiteDocumentRow | null>;
    findFirst: (args: unknown) => Promise<SiteDocumentRow | null>;
    create: (args: unknown) => Promise<SiteDocumentRow>;
    update: (args: unknown) => Promise<SiteDocumentRow>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    count: (args: unknown) => Promise<number>;
  };
  documentLog: {
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
  legalDocumentAcceptance: {
    findMany: (args: unknown) => Promise<unknown[]>;
    findFirst: (args: unknown) => Promise<unknown | null>;
    findUnique: (args: unknown) => Promise<unknown | null>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
  };
};

const prismaDocs = prisma as unknown as PrismaClientWithDocs;

export interface CreateSiteDocumentData {
  type: SiteDocumentType;
  title: string;
  description?: string | null;
  fileName: string;
  s3Key: string;
  contentType: string;
  fileSize: number;
  fileHash?: string | null;
  showInAccount: boolean;
  uploadedBy: string;
  version: number;
  audience: LegalDocumentAudience;
  acceptanceRequired: boolean;
  openBeforeAcceptRequired: boolean;
  reacceptanceRequired: boolean;
  effectiveDate?: Date | null;
  status?: LegalDocumentStatus;
}

export interface UpdateSiteDocumentData {
  title?: string;
  description?: string | null;
  showInAccount?: boolean;
  audience?: LegalDocumentAudience;
  acceptanceRequired?: boolean;
  openBeforeAcceptRequired?: boolean;
  reacceptanceRequired?: boolean;
  effectiveDate?: Date | null;
}

export interface CreateDocumentLogData {
  userId: string;
  documentId?: string | null;
  eventType: DocumentEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class SiteDocumentRepository {
  async findAll(params: {
    page: number;
    pageSize: number;
    type?: SiteDocumentType;
    status?: LegalDocumentStatus;
    audience?: LegalDocumentAudience;
    includeInactive?: boolean;
    search?: string;
  }) {
    const { page, pageSize, type, status, audience, includeInactive, search } = params;
    const skip = (page - 1) * pageSize;

    const where = {} as Record<string, unknown>;

    if (type) where.type = type;
    if (status) where.status = status;
    if (audience) where.audience = audience;

    // Match origin/main: default list is active documents only.
    if (!includeInactive && !status) {
      where.is_active = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { file_name: { contains: search, mode: "insensitive" } },
      ];
    }

    const [documents, total] = await Promise.all([
      prismaDocs.siteDocument.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
      }),
      prismaDocs.siteDocument.count({ where }),
    ]);

    return { documents, total };
  }

  async findById(id: string) {
    return prismaDocs.siteDocument.findUnique({
      where: { id },
    });
  }

  async findActiveByType(type: SiteDocumentType) {
    return prismaDocs.siteDocument.findFirst({
      where: {
        type,
        status: "PUBLISHED",
        is_active: true,
      },
      orderBy: { version: "desc" },
    });
  }

  async findPublishedReacceptanceByTypeAndAudiences(
    type: SiteDocumentType,
    audiences: LegalDocumentAudience[]
  ) {
    return prismaDocs.siteDocument.findFirst({
      where: {
        type,
        status: "PUBLISHED",
        audience: { in: audiences },
        acceptance_required: true,
        reacceptance_required: true,
      },
      orderBy: { version: "desc" },
    });
  }

  async findPublishedByTypeAndAudiences(
    type: SiteDocumentType,
    audiences: LegalDocumentAudience[]
  ) {
    return prismaDocs.siteDocument.findFirst({
      where: {
        type,
        status: "PUBLISHED",
        audience: { in: audiences },
        acceptance_required: true,
      },
      orderBy: { version: "desc" },
    });
  }

  async findPublishedForPublic(types: SiteDocumentType[]) {
    return prismaDocs.siteDocument.findMany({
      where: {
        type: { in: types },
        status: "PUBLISHED",
        audience: { in: ["PUBLIC", "BOTH", "ISSUER", "INVESTOR"] },
      },
      orderBy: [{ type: "asc" }, { version: "desc" }],
    });
  }

  async findActiveForAccount() {
    return prismaDocs.siteDocument.findMany({
      where: {
        status: "PUBLISHED",
        is_active: true,
        show_in_account: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async findAllActive() {
    return prismaDocs.siteDocument.findMany({
      where: { status: "PUBLISHED", is_active: true },
      orderBy: { created_at: "desc" },
    });
  }

  async create(data: CreateSiteDocumentData) {
    const status = data.status ?? "PUBLISHED";
    const now = new Date();
    return prismaDocs.siteDocument.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        file_name: data.fileName,
        s3_key: data.s3Key,
        content_type: data.contentType,
        file_size: data.fileSize,
        file_hash: data.fileHash ?? null,
        show_in_account: data.showInAccount,
        uploaded_by: data.uploadedBy,
        version: data.version,
        audience: data.audience,
        status,
        is_active: status === "PUBLISHED",
        acceptance_required: data.acceptanceRequired,
        open_before_accept_required: data.openBeforeAcceptRequired,
        reacceptance_required: data.reacceptanceRequired,
        effective_date: data.effectiveDate ?? null,
        ...(status === "PUBLISHED"
          ? {
              published_by: data.uploadedBy,
              published_at: now,
            }
          : {}),
      },
    });
  }

  async update(id: string, data: UpdateSiteDocumentData) {
    return prismaDocs.siteDocument.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.showInAccount !== undefined && { show_in_account: data.showInAccount }),
        ...(data.audience !== undefined && { audience: data.audience }),
        ...(data.acceptanceRequired !== undefined && {
          acceptance_required: data.acceptanceRequired,
        }),
        ...(data.openBeforeAcceptRequired !== undefined && {
          open_before_accept_required: data.openBeforeAcceptRequired,
        }),
        ...(data.reacceptanceRequired !== undefined && {
          reacceptance_required: data.reacceptanceRequired,
        }),
        ...(data.effectiveDate !== undefined && { effective_date: data.effectiveDate }),
      },
    });
  }

  async publish(id: string, adminUserId: string, reacceptanceRequired: boolean) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.siteDocument.findUnique({ where: { id } });
      if (!existing) return null;

      await tx.siteDocument.updateMany({
        where: {
          type: existing.type,
          audience: existing.audience,
          status: "PUBLISHED",
          id: { not: id },
        },
        data: {
          status: "ARCHIVED",
          is_active: false,
          archived_by: adminUserId,
          archived_at: new Date(),
        },
      });

      return tx.siteDocument.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          is_active: true,
          reacceptance_required: reacceptanceRequired,
          published_by: adminUserId,
          published_at: new Date(),
          archived_by: null,
          archived_at: null,
        },
      });
    });
  }

  async archive(id: string, adminUserId: string) {
    return prismaDocs.siteDocument.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        is_active: false,
        archived_by: adminUserId,
        archived_at: new Date(),
      },
    });
  }

  async softDelete(id: string) {
    return prismaDocs.siteDocument.update({
      where: { id },
      data: {
        is_active: false,
        status: "ARCHIVED",
        archived_at: new Date(),
      },
    });
  }

  async replaceFile(
    id: string,
    data: {
      s3Key: string;
      fileName: string;
      fileSize: number;
      newVersion: number;
      fileHash?: string | null;
    }
  ) {
    return prismaDocs.siteDocument.update({
      where: { id },
      data: {
        s3_key: data.s3Key,
        file_name: data.fileName,
        file_size: data.fileSize,
        version: data.newVersion,
        ...(data.fileHash !== undefined && { file_hash: data.fileHash }),
      },
    });
  }

  async restore(id: string) {
    return prismaDocs.siteDocument.update({
      where: { id },
      data: {
        is_active: true,
        status: "PUBLISHED",
        archived_by: null,
        archived_at: null,
      },
    });
  }

  async getLatestVersionByType(type: SiteDocumentType): Promise<number> {
    const latest = await prismaDocs.siteDocument.findFirst({
      where: { type },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest as { version?: number } | null)?.version ?? 0;
  }
}

export class DocumentLogRepository {
  async create(data: CreateDocumentLogData) {
    return prismaDocs.documentLog.create({
      data: {
        user_id: data.userId,
        document_id: data.documentId,
        event_type: data.eventType,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        device_info: data.deviceInfo,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async findAll(params: GetDocumentLogsQuery) {
    const { page, pageSize, search, eventType, dateRange } = params;
    const skip = (page - 1) * pageSize;

    const where = {} as Record<string, unknown>;

    if (eventType) {
      where.event_type = eventType;
    }

    if (dateRange !== "all") {
      const now = new Date();
      let startDate: Date = now;
      switch (dateRange) {
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      where.created_at = { gte: startDate };
    }

    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { first_name: { contains: search, mode: "insensitive" } } },
        { user: { last_name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prismaDocs.documentLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
              roles: true,
            },
          },
        },
      }),
      prismaDocs.documentLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findForExport(params: {
    search?: string;
    eventType?: DocumentEventType;
    eventTypes?: DocumentEventType[];
    dateRange: "24h" | "7d" | "30d" | "all";
  }) {
    const where = {} as Record<string, unknown>;

    if (params.eventType) {
      where.event_type = params.eventType;
    } else if (params.eventTypes && params.eventTypes.length > 0) {
      where.event_type = { in: params.eventTypes };
    }

    if (params.dateRange !== "all") {
      const now = new Date();
      let startDate: Date = now;
      switch (params.dateRange) {
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      where.created_at = { gte: startDate };
    }

    if (params.search) {
      where.OR = [
        { user: { email: { contains: params.search, mode: "insensitive" } } },
        { user: { first_name: { contains: params.search, mode: "insensitive" } } },
        { user: { last_name: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    return prismaDocs.documentLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 10000,
      include: {
        user: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            roles: true,
          },
        },
      },
    });
  }
}

export const siteDocumentRepository = new SiteDocumentRepository();
export const documentLogRepository = new DocumentLogRepository();
export type { SiteDocumentRow };
