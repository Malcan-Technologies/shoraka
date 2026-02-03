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

const router = Router();
const productRepository = new ProductRepository();

const SUPPORTING_DOC_CATEGORY_KEYS = ["financial_docs", "legal_docs", "compliance_docs", "others"] as const;
const PRODUCT_ASSET_KEY_PREFIX = "products/";

function getStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

function getConfig(step: unknown): Record<string, unknown> {
  return ((step as { config?: unknown }).config as Record<string, unknown>) ?? {};
}

/** Collect S3 keys that are in the old workflow but replaced (different or removed) in the new workflow. Only returns keys under products/. */
function getReplacedProductAssetKeys(
  oldWorkflow: unknown[],
  newWorkflow: unknown[]
): string[] {
  const keys = new Set<string>();
  const oldSteps = Array.isArray(oldWorkflow) ? oldWorkflow : [];
  const newSteps = Array.isArray(newWorkflow) ? newWorkflow : [];

  const oldFirst = oldSteps.find((s) => getStepId(s).startsWith("financing_type"));
  const newFirst = newSteps.find((s) => getStepId(s).startsWith("financing_type"));
  const oldConfig = oldFirst ? getConfig(oldFirst) : {};
  const newConfig = newFirst ? getConfig(newFirst) : {};
  const oldImage = oldConfig.image as { s3_key?: string } | undefined;
  const newImage = newConfig.image as { s3_key?: string } | undefined;
  const oldImageKey = (oldImage?.s3_key ?? oldConfig.s3_key) as string | undefined;
  const newImageKey = (newImage?.s3_key ?? newConfig.s3_key) as string | undefined;
  const oldKeyTrim = oldImageKey?.trim();
  if (oldKeyTrim && oldKeyTrim !== (newImageKey?.trim() ?? "")) {
    if (oldKeyTrim.startsWith(PRODUCT_ASSET_KEY_PREFIX)) keys.add(oldKeyTrim);
  }

  const oldSupporting = oldSteps.find((s) => getStepId(s).startsWith("supporting_documents"));
  const newSupporting = newSteps.find((s) => getStepId(s).startsWith("supporting_documents"));
  const oldSupportConfig = oldSupporting ? getConfig(oldSupporting) : {};
  const newSupportConfig = newSupporting ? getConfig(newSupporting) : {};
  for (const category of SUPPORTING_DOC_CATEGORY_KEYS) {
    const oldList = (oldSupportConfig[category] as Array<{ template?: { s3_key?: string } }>) ?? [];
    const newList = (newSupportConfig[category] as Array<{ template?: { s3_key?: string } }>) ?? [];
    const maxLen = Math.max(oldList.length, newList.length);
    for (let i = 0; i < maxLen; i++) {
      const oldItem = oldList[i];
      const newItem = newList[i];
      const oldT = oldItem?.template?.s3_key?.trim();
      const newT = newItem?.template?.s3_key?.trim() ?? "";
      if (oldT && oldT !== newT && oldT.startsWith(PRODUCT_ASSET_KEY_PREFIX)) {
        keys.add(oldT);
      }
    }
  }
  return [...keys];
}

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
 * Update a product (admin only). Replaced asset keys (image, document templates) are deleted from S3 after a successful update.
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
        ? getReplacedProductAssetKeys(oldWorkflow, validated.workflow)
        : [];

    const product = await productRepository.update(id, {
      workflow: validated.workflow,
      completeCreate: validated.completeCreate,
    });

    for (const key of keysToDelete) {
      try {
        await deleteS3Object(key);
      } catch (err) {
        logger.warn({ err, key }, "Failed to delete replaced product asset from S3");
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
