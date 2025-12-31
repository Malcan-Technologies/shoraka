import { prisma } from "../../lib/prisma";
import { SiteDocumentType, Prisma } from "@prisma/client";
import type { DocumentEventType, GetDocumentLogsQuery } from "./schemas";

export interface CreateSiteDocumentData {
  type: SiteDocumentType;
  title: string;
  description?: string | null;
  fileName: string;
  s3Key: string;
  contentType: string;
  fileSize: number;
  showInAccount: boolean;
  uploadedBy: string;
}

export interface UpdateSiteDocumentData {
  title?: string;
  description?: string | null;
  showInAccount?: boolean;
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
    includeInactive?: boolean;
    search?: string;
  }) {
    const { page, pageSize, type, includeInactive, search } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SiteDocumentWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (!includeInactive) {
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
      prisma.siteDocument.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
      }),
      prisma.siteDocument.count({ where }),
    ]);

    return { documents, total };
  }

  async findById(id: string) {
    return prisma.siteDocument.findUnique({
      where: { id },
    });
  }

  async findActiveByType(type: SiteDocumentType) {
    return prisma.siteDocument.findFirst({
      where: {
        type,
        is_active: true,
      },
      orderBy: { version: "desc" },
    });
  }

  async findActiveForAccount() {
    return prisma.siteDocument.findMany({
      where: {
        is_active: true,
        show_in_account: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async findAllActive() {
    return prisma.siteDocument.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
    });
  }

  async create(data: CreateSiteDocumentData) {
    return prisma.siteDocument.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        file_name: data.fileName,
        s3_key: data.s3Key,
        content_type: data.contentType,
        file_size: data.fileSize,
        show_in_account: data.showInAccount,
        uploaded_by: data.uploadedBy,
        version: 1,
        is_active: true,
      },
    });
  }

  async update(id: string, data: UpdateSiteDocumentData) {
    return prisma.siteDocument.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.showInAccount !== undefined && { show_in_account: data.showInAccount }),
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
    }
  ) {
    return prisma.siteDocument.update({
      where: { id },
      data: {
        s3_key: data.s3Key,
        file_name: data.fileName,
        file_size: data.fileSize,
        version: data.newVersion,
      },
    });
  }

  async softDelete(id: string) {
    return prisma.siteDocument.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async restore(id: string) {
    return prisma.siteDocument.update({
      where: { id },
      data: { is_active: true },
    });
  }

  async getLatestVersionByType(type: SiteDocumentType): Promise<number> {
    const latest = await prisma.siteDocument.findFirst({
      where: { type },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return latest?.version ?? 0;
  }
}

export class DocumentLogRepository {
  async create(data: CreateDocumentLogData) {
    return prisma.documentLog.create({
      data: {
        user_id: data.userId,
        document_id: data.documentId,
        event_type: data.eventType,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        device_info: data.deviceInfo,
        metadata: data.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });
  }

  async findAll(params: GetDocumentLogsQuery) {
    const { page, pageSize, search, eventType, dateRange } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.DocumentLogWhereInput = {};

    if (eventType) {
      where.event_type = eventType;
    }

    if (dateRange !== "all") {
      const now = new Date();
      let startDate: Date;
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
      prisma.documentLog.findMany({
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
      prisma.documentLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findForExport(params: {
    search?: string;
    eventType?: DocumentEventType;
    eventTypes?: DocumentEventType[];
    dateRange: "24h" | "7d" | "30d" | "all";
  }) {
    const where: Prisma.DocumentLogWhereInput = {};

    if (params.eventType) {
      where.event_type = params.eventType;
    } else if (params.eventTypes && params.eventTypes.length > 0) {
      where.event_type = { in: params.eventTypes };
    }

    if (params.dateRange !== "all") {
      const now = new Date();
      let startDate: Date;
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

    return prisma.documentLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 10000, // Limit export to prevent memory issues
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

