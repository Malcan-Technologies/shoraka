import { prisma } from "../../lib/prisma";
import { Product, Prisma } from "@prisma/client";

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
          LOWER((p.workflow::jsonb->0->'config'->'type'->>'title')::text) LIKE LOWER(${searchTerm})
          OR LOWER((p.workflow::jsonb->0->'config'->'type'->>'category')::text) LIKE LOWER(${searchTerm})
        ORDER BY p.created_at DESC
        LIMIT ${params.pageSize} OFFSET ${skip}
      `;

      const countQuery = Prisma.sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM products p
        WHERE 
          LOWER((p.workflow::jsonb->0->'config'->'type'->>'title')::text) LIKE LOWER(${searchTerm})
          OR LOWER((p.workflow::jsonb->0->'config'->'type'->>'category')::text) LIKE LOWER(${searchTerm})
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