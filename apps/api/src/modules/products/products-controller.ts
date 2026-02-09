import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/http/error-handler";
import { deleteS3Object } from "../../lib/s3/client";
import { logger } from "../../lib/logger";
import { ProductRepository } from "./repository";
import { createProductUploadsRouter } from "./product-uploads-controller";
import {
  getProductsListQuerySchema,
  createProductBodySchema,
  updateProductBodySchema,
} from "./schemas";
import {
  createProductLog,
  buildProductLogMetadata,
  getProductS3KeysFromWorkflow,
  getReplacedProductS3Keys,
} from "./product-log";

const router = Router();
const productRepository = new ProductRepository();

/**
 * GET /v1/products
 * List products with pagination and optional search (admin only).
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getProductsListQuerySchema.parse(req.query);
      const { products, total } = await productRepository.findAll({
        page: validated.page,
        pageSize: validated.pageSize,
        search: validated.search,
      });

      const pageSize = validated.pageSize;
      const totalPages = Math.ceil(total / pageSize) || 1;

      res.json({
        success: true,
        data: {
          products: products.map((p) => ({
            id: p.id,
            version: p.version,
            workflow: p.workflow as unknown[],
            created_at: p.created_at.toISOString(),
            updated_at: p.updated_at.toISOString(),
          })),
          pagination: {
            page: validated.page,
            pageSize,
            totalCount: total,
            totalPages,
          },
        },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
      );
    }
  }
);

/**
 * POST /v1/products
 * Create a product (admin only).
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createProductBodySchema.parse(req.body);
    const product = await productRepository.create({
      workflow: validated.workflow,
    });
    const workflowArr = (product.workflow as unknown[]) ?? [];
    await createProductLog(req, "PRODUCT_CREATED", product.id, buildProductLogMetadata(workflowArr, product.version, product.created_at, product.updated_at));
    res.status(201).json({
      success: true,
      data: {
        id: product.id,
        version: product.version,
        workflow: product.workflow as unknown[],
        created_at: product.created_at.toISOString(),
        updated_at: product.updated_at.toISOString(),
      },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(
      error instanceof Error
        ? new AppError(400, "VALIDATION_ERROR", error.message)
        : error
    );
  }
});

/**
 * GET /v1/products/:id
 * Get a single product by id (admin only).
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const product = await productRepository.findById(id);
      if (!product) {
        throw new AppError(404, "NOT_FOUND", "Product not found");
      }
      res.json({
        success: true,
        data: {
          id: product.id,
          version: product.version,
          workflow: product.workflow as unknown[],
          created_at: product.created_at.toISOString(),
          updated_at: product.updated_at.toISOString(),
        },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /v1/products/:id
 * Update a product (admin only). Replaced S3 keys (image, document templates) are deleted from S3 after a successful update.
 */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = updateProductBodySchema.parse(req.body);
    const current = await productRepository.findById(id);
    if (!current) {
      throw new AppError(404, "NOT_FOUND", "Product not found");
    }
    const oldWorkflow = (current.workflow as unknown[]) ?? [];
    const keysToDelete =
      validated.workflow !== undefined
        ? getReplacedProductS3Keys(oldWorkflow, validated.workflow)
        : [];

    const product = await productRepository.update(id, {
      workflow: validated.workflow,
      completeCreate: validated.completeCreate,
    });

    const newWorkflow = (product.workflow as unknown[]) ?? [];
    await createProductLog(req, "PRODUCT_UPDATED", id, buildProductLogMetadata(newWorkflow, product.version, product.created_at, product.updated_at));

    for (const key of keysToDelete) {
      try {
        await deleteS3Object(key);
      } catch (err) {
        logger.warn({ err, key }, "Failed to delete replaced product file from S3");
      }
    }

    res.json({
      success: true,
      data: {
        id: product.id,
        version: product.version,
        workflow: product.workflow as unknown[],
        created_at: product.created_at.toISOString(),
        updated_at: product.updated_at.toISOString(),
      },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(
      error instanceof Error
        ? new AppError(400, "VALIDATION_ERROR", error.message)
        : error
    );
  }
});

/** S3 upload URLs for product image and templates (key version is per file, separate from product version). */
router.use("/:id", createProductUploadsRouter(productRepository));

/**
 * DELETE /v1/products/:id
 * Delete a product (admin only). Also deletes all S3 objects referenced in the product workflow (image and document templates).
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(404, "NOT_FOUND", "Product not found");
    }
    const workflow = (product.workflow as unknown[]) ?? [];
    const keysToDelete = getProductS3KeysFromWorkflow(workflow);

    await createProductLog(req, "PRODUCT_DELETED", id, buildProductLogMetadata(workflow, product.version, product.created_at, product.updated_at));

    await productRepository.delete(id);

    for (const key of keysToDelete) {
      try {
        await deleteS3Object(key);
      } catch (err) {
        logger.warn({ err, key }, "Failed to delete product file from S3 after product delete");
      }
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export const productsRouter = router;
