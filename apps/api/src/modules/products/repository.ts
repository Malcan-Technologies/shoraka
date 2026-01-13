import { prisma } from "../../lib/prisma";
import { Product, Prisma } from "@prisma/client";
import type { ProductEventType, GetProductLogsQuery, DateRangeValue } from "./schemas";

export class ProductRepository {
  /**
   * Create a new product
   */
  async create(data: { workflow: Prisma.InputJsonValue }): Promise<Product> {
    return prisma.product.create({
      data: {
        workflow: data.workflow,
      },
    });
  }

  /**
   * Find product by ID
   */
  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  /**
   * List products with pagination and search
   */
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{
    products: Product[];
    totalCount: number;
  }> {
    const skip = (params.page - 1) * params.pageSize;

    if (params.search && params.search.trim()) {
      const searchTerm = `%${params.search.trim()}%`;
      
      const searchQuery = Prisma.sql`
        SELECT DISTINCT p.*
        FROM products p
        WHERE 
          LOWER((p.workflow::jsonb->0->'config'->'type'->>'name')::text) LIKE LOWER(${searchTerm})
          OR LOWER((p.workflow::jsonb->0->'config'->'type'->>'category')::text) LIKE LOWER(${searchTerm})
        ORDER BY p.created_at DESC
        LIMIT ${params.pageSize} OFFSET ${skip}
      `;

      const countQuery = Prisma.sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM products p
        WHERE 
          LOWER((p.workflow::jsonb->0->'config'->'type'->>'name')::text) LIKE LOWER(${searchTerm})
          OR LOWER((p.workflow::jsonb->0->'config'->'type'->>'description')::text) LIKE LOWER(${searchTerm})
      `;

      const [productsResult, countResult] = await Promise.all([
        prisma.$queryRaw<Product[]>(searchQuery),
        prisma.$queryRaw<[{ count: bigint }]>(countQuery),
      ]);

      const totalCount = Number(countResult[0]?.count || 0);

      return {
        products: productsResult,
        totalCount,
      };
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: params.pageSize,
        orderBy: { created_at: "desc" },
      }),
      prisma.product.count(),
    ]);

    return { products, totalCount };
  }

  /**
   * Update product
   */
  async update(
    id: string,
    data: { workflow?: Prisma.InputJsonValue }
  ): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        ...(data.workflow && { workflow: data.workflow }),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Delete product
   */
  async delete(id: string): Promise<void> {
    await prisma.product.delete({
      where: { id },
    });
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