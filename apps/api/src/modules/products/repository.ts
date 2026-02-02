import { prisma } from "../../lib/prisma";
import { Product, Prisma } from "@prisma/client";
import type { ProductEventType, GetProductLogsQuery, DateRangeValue } from "./schemas";

export interface ListProductsParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface UpdateProductData {
  workflow?: unknown[];
}

export interface CreateProductData {
  workflow: unknown[];
}

/**
 * Product read/write: findById, list, create, update, delete. Used by applications module and admin products list.
 */
export class ProductRepository {
  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  async create(data: CreateProductData): Promise<Product> {
    return prisma.product.create({
      data: {
        version: 1,
        workflow: data.workflow as Prisma.InputJsonValue,
      },
    });
  }

  /** Update product. Version is always auto-incremented on every change; client cannot set it. */
  async update(id: string, data: UpdateProductData): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        ...(data.workflow !== undefined && {
          workflow: data.workflow as Prisma.InputJsonValue,
          version: { increment: 1 },
        }),
      },
    });
  }

  async delete(id: string): Promise<Product> {
    return prisma.product.delete({
      where: { id },
    });
  }

  async findAll(params: ListProductsParams): Promise<{ products: Product[]; total: number }> {
    const { page, pageSize, search } = params;
    const skip = (page - 1) * pageSize;
    const searchTrim = search?.trim();

    if (!searchTrim) {
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          skip,
          take: pageSize,
          orderBy: { updated_at: "desc" },
        }),
        prisma.product.count(),
      ]);
      return { products, total };
    }

    const pattern = `%${searchTrim}%`;
    const [products, countResult] = await Promise.all([
      prisma.$queryRaw<Product[]>`
        SELECT * FROM products
        WHERE (
          (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
          OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
        )
        ORDER BY updated_at DESC
        LIMIT ${pageSize} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count FROM products
        WHERE (
          (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
          OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
        )
      `,
    ]);
    const total = countResult[0]?.count ?? 0;
    return { products, total };
  }
}

export interface CreateProductLogData {
  userId: string;
  productId?: string | null;
  eventType: ProductEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Product log repository: read/write product audit logs only.
 * Product CRUD and image logic have been removed.
 */
export class ProductLogRepository {
  async create(data: CreateProductLogData) {
    return prisma.productLog.create({
      data: {
        user_id: data.userId,
        product_id: data.productId ?? null,
        event_type: data.eventType,
        ip_address: data.ipAddress ?? null,
        user_agent: data.userAgent ?? null,
        device_info: data.deviceInfo ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async findAll(params: GetProductLogsQuery) {
    const { page, pageSize, search, eventType, dateRange } = params;
    const skip = (page - 1) * pageSize;

    const where = {} as Record<string, unknown>;

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
      prisma.productLog.findMany({
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
      prisma.productLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findForExport(params: {
    search?: string;
    eventType?: ProductEventType;
    eventTypes?: ProductEventType[];
    dateRange: DateRangeValue;
  }) {
    const where = {} as Record<string, unknown>;

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

    return prisma.productLog.findMany({
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

export const productLogRepository = new ProductLogRepository();
