import { Request } from "express";
import { ProductRepository } from "./repository";
import {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from "./schemas";
import { Product, Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { extractRequestMetadata } from "../../lib/http/request-utils";

export class ProductService {
  private repository: ProductRepository;

  constructor() {
    this.repository = new ProductRepository();
  }

  /**
   * Create a new product
   */
  async createProduct(
    req: Request,
    input: CreateProductInput
  ): Promise<Product> {
    const metadata = extractRequestMetadata(req);
    
    logger.info({ ...metadata, input }, "Creating product");

    // Add any business logic here (e.g., validation, defaults)
    // Cast to InputJsonValue for Prisma compatibility
    const product = await this.repository.create({
      workflow: input.workflow as Prisma.InputJsonValue,
    });

    logger.info({ ...metadata, productId: product.id }, "Product created");

    return product;
  }

  /**
   * Get product by ID
   */
  async getProduct(req: Request, id: string): Promise<Product> {
    const product = await this.repository.findById(id);

    if (!product) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    return product;
  }

  /**
   * List products with pagination
   */
  async listProducts(
    req: Request,
    params: ListProductsQuery
  ): Promise<{
    products: Product[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { products, totalCount } = await this.repository.list({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
    });

    const totalPages = Math.ceil(totalCount / params.pageSize);

    return {
      products,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        totalPages,
      },
    };
  }

  /**
   * Update product
   */
  async updateProduct(
    req: Request,
    id: string,
    input: UpdateProductInput
  ): Promise<Product> {
    const metadata = extractRequestMetadata(req);
    
    // Check if product exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    logger.info({ ...metadata, productId: id, input }, "Updating product");

    const product = await this.repository.update(id, {
      workflow: input.workflow ? (input.workflow as Prisma.InputJsonValue) : undefined,
    });

    logger.info({ ...metadata, productId: product.id }, "Product updated");

    return product;
  }

  /**
   * Delete product
   */
  async deleteProduct(req: Request, id: string): Promise<void> {
    const metadata = extractRequestMetadata(req);
    
    // Check if product exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    logger.info({ ...metadata, productId: id }, "Deleting product");

    await this.repository.delete(id);

    logger.info({ ...metadata, productId: id }, "Product deleted");
  }
}