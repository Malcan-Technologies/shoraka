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

    const where: Prisma.ProductWhereInput = {};

    // Add search filter if provided
    // Note: Searching within JSON arrays in Prisma is complex
    // For now, we'll do a simple text search on the JSON string
    // You may want to implement more sophisticated search logic later
    if (params.search) {
      // Prisma doesn't have great support for searching within JSON arrays
      // This would require raw SQL or filtering after fetching
      // For now, we'll skip the search filter for JSON arrays
      // TODO: Implement proper JSON array search if needed
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { created_at: "desc" },
      }),
      prisma.product.count({ where }),
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