import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/http/error-handler";
import { generatePresignedUploadUrl } from "../../lib/s3/client";
import { generateProductAssetKey, getFileExtension } from "../../lib/s3/client";
import { ProductRepository } from "./repository";
import {
  getProductsListQuerySchema,
  createProductBodySchema,
  updateProductBodySchema,
  productImageUploadUrlBodySchema,
  productDocumentTemplateUploadUrlBodySchema,
} from "./schemas";

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
 * POST /v1/products/upload-image-url
 * Request presigned URL for uploading a product image (admin only). Key stored in workflow config.
 */
router.post("/upload-image-url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = productImageUploadUrlBodySchema.parse(req.body);
    const ext = getFileExtension(validated.fileName) || "png";
    const key = generateProductAssetKey({
      productId: validated.productId,
      version: validated.version,
      extension: ext,
    });
    const { uploadUrl, key: s3Key, expiresIn } = await generatePresignedUploadUrl({
      key,
      contentType: validated.contentType,
    });
    res.json({
      success: true,
      data: { uploadUrl, s3Key, expiresIn },
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
 * POST /v1/products/upload-document-template-url
 * Request presigned URL for uploading a product document template (admin only). Key stored in workflow config.
 */
router.post("/upload-document-template-url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = productDocumentTemplateUploadUrlBodySchema.parse(req.body);
    const ext = getFileExtension(validated.fileName) || "pdf";
    const key = generateProductAssetKey({
      productId: validated.productId,
      version: validated.version,
      extension: ext,
    });
    const { uploadUrl, key: s3Key, expiresIn } = await generatePresignedUploadUrl({
      key,
      contentType: validated.contentType,
    });
    res.json({
      success: true,
      data: { uploadUrl, s3Key, expiresIn },
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
 * POST /v1/products
 * Create a product (admin only).
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createProductBodySchema.parse(req.body);
    const product = await productRepository.create({
      workflow: validated.workflow,
    });
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
 * Update a product (admin only).
 */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = updateProductBodySchema.parse(req.body);
    const product = await productRepository.update(id, {
      workflow: validated.workflow,
    });
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

/**
 * DELETE /v1/products/:id
 * Delete a product (admin only).
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(404, "NOT_FOUND", "Product not found");
    }
    await productRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export const productsRouter = router;
