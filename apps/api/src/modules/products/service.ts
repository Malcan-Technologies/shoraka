import { Request } from "express";
import { ProductRepository, productLogRepository } from "./repository";
import {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
  ProductEventType,
  GetProductLogsQuery,
  ExportProductLogsQuery,
} from "./schemas";
import { Product, Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { extractRequestMetadata, getDeviceInfo } from "../../lib/http/request-utils";

export class ProductService {
  private repository: ProductRepository;

  private async logProductEvent(
    req: Request,
    userId: string,
    productId: string | null,
    eventType: ProductEventType,
    metadata: Record<string, unknown>
  ) {
    const deviceInfo = getDeviceInfo(req);
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;

    await productLogRepository.create({
      userId,
      productId,
      eventType,
      ipAddress,
      userAgent: req.headers["user-agent"] ?? null,
      deviceInfo,
      metadata,
    });
  }

  constructor() {
    this.repository = new ProductRepository();
  }

  /**
   * Create a new product
   */
  async createProduct(req: Request, input: CreateProductInput): Promise<Product> {
    const metadata = extractRequestMetadata(req);

    logger.info({ ...metadata, input }, "Creating product");

    // Add any business logic here (e.g., validation, defaults)
    // Cast to InputJsonValue for Prisma compatibility
    const product = await this.repository.create({
      workflow: input.workflow as Prisma.InputJsonValue,
    });

    logger.info({ ...metadata, productId: product.id }, "Product created");

    // Log the product creation
    if (req.user?.user_id) {
      await this.logProductEvent(
        req,
        req.user.user_id,
        product.id,
        "PRODUCT_CREATED",
        {
          product_id: product.id,
        }
      );
    }

    return product;
  }

  /**
   * Get product by ID
   */
  async getProduct(id: string): Promise<Product> {
    const product = await this.repository.findById(id);

    if (!product) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    return product;
  }

  /**
   * List products with pagination
   */
  async listProducts(params: ListProductsQuery): Promise<{
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
  async updateProduct(req: Request, id: string, input: UpdateProductInput): Promise<Product> {
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

    // Log the product update
    if (req.user?.user_id) {
      await this.logProductEvent(
        req,
        req.user.user_id,
        product.id,
        "PRODUCT_UPDATED",
        {
          product_id: product.id,
        }
      );
    }

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

    // Log the product deletion
    if (req.user?.user_id) {
      await this.logProductEvent(
        req,
        req.user.user_id,
        id,
        "PRODUCT_DELETED",
        {
          product_id: id,
        }
      );
    }
  }

  /**
   * Get product logs with pagination and filters
   */
  async getProductLogs(query: GetProductLogsQuery) {
    const { logs, total } = await productLogRepository.findAll(query);

    return {
      logs,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  /**
   * Export product logs
   */
  async exportProductLogs(query: Omit<ExportProductLogsQuery, "format">) {
    return productLogRepository.findForExport({
      search: query.search,
      eventType: query.eventType,
      eventTypes: query.eventTypes,
      dateRange: query.dateRange,
    });
  }
}

export const productService = new ProductService();
