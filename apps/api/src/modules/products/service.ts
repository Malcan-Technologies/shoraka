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
import { deleteS3Object } from "../../lib/s3/client";

export class ProductService {
  private repository: ProductRepository;

  /**
   * Extract product name from workflow JSON
   */
  private extractProductName(workflow: Prisma.JsonValue): string | null {
    try {
      if (!workflow || !Array.isArray(workflow) || workflow.length === 0) {
        return null;
      }

      const firstStep = workflow[0] as { config?: { type?: { name?: string } } };
      return firstStep?.config?.type?.name || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract S3 key from workflow JSON (from financing type step)
   */
  private extractS3Key(workflow: Prisma.JsonValue): string | null {
    try {
      if (!workflow || !Array.isArray(workflow)) {
        return null;
      }

      for (const step of workflow) {
        const stepObj = step as { name?: string; config?: { s3_key?: string; type?: { s3_key?: string } } };
        if (stepObj.name?.toLowerCase().includes("financing type")) {
          // Prioritize direct s3_key, fallback to type.s3_key for legacy/different structures
          const s3Key = stepObj.config?.s3_key || stepObj.config?.type?.s3_key;
          return typeof s3Key === 'string' && s3Key.trim().length > 0 ? s3Key : null;
        }
      }
      return null;
    } catch (error) {
      logger.error({ error }, "Error extracting S3 key from workflow");
      return null;
    }
  }

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
      const productName = this.extractProductName(product.workflow);
      await this.logProductEvent(
        req,
        req.user.user_id,
        product.id,
        "PRODUCT_CREATED",
        {
          product_id: product.id,
          name: productName,
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

    // Extract old S3 key before updating (to delete old version if replaced)
    const oldS3Key = this.extractS3Key(existing.workflow);
    const newS3Key = input.workflow ? this.extractS3Key(input.workflow as Prisma.JsonValue) : null;

    const product = await this.repository.update(id, {
      workflow: input.workflow ? (input.workflow as Prisma.InputJsonValue) : undefined,
    });

    logger.info({ ...metadata, productId: product.id }, "Product updated");

    // Delete old S3 key if it was replaced with a new version
    if (oldS3Key && newS3Key && oldS3Key !== newS3Key) {
      try {
        logger.info({ oldS3Key, newS3Key, productId: id }, "Deleting old product image version from S3");
        await deleteS3Object(oldS3Key);
        logger.info({ oldS3Key, productId: id }, "Successfully deleted old product image version from S3");
      } catch (error) {
        logger.warn(
          { oldS3Key, newS3Key, productId: id, error },
          "Failed to delete old product image version from S3 (product update will continue)"
        );
        // Don't throw - product is already updated, S3 cleanup failure shouldn't block
      }
    }

    // Log the product update
    if (req.user?.user_id) {
      const productName = this.extractProductName(product.workflow);
      await this.logProductEvent(
        req,
        req.user.user_id,
        product.id,
        "PRODUCT_UPDATED",
        {
          product_id: product.id,
          name: productName,
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

    // Extract product name and S3 key before deletion
    const productName = this.extractProductName(existing.workflow);
    const s3Key = this.extractS3Key(existing.workflow);

    // Delete the product from database
    await this.repository.delete(id);

    logger.info({ ...metadata, productId: id }, "Product deleted");

    // Delete S3 image if it exists
    if (s3Key) {
      try {
        logger.info({ s3Key, productId: id }, "Deleting product image from S3");
        await deleteS3Object(s3Key);
        logger.info({ s3Key, productId: id }, "Successfully deleted product image from S3");
      } catch (error) {
        logger.warn(
          { s3Key, productId: id, error },
          "Failed to delete product image from S3 (product deletion will continue)"
        );
        // Don't throw - product is already deleted, S3 cleanup failure shouldn't block
      }
    }

    // Log the product deletion
    if (req.user?.user_id) {
      await this.logProductEvent(
        req,
        req.user.user_id,
        id,
        "PRODUCT_DELETED",
        {
          product_id: id,
          name: productName,
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
