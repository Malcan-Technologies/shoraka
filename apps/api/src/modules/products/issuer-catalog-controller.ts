import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../lib/http/error-handler";
import { ProductRepository } from "./repository";
import { getProductsListQuerySchema } from "./schemas";

const router = Router();
const productRepository = new ProductRepository();

const productIdParamsSchema = z.object({
  productId: z.string().min(1),
});

function toIssuerCatalogProduct(p: {
  id: string;
  version: number;
  workflow: unknown;
  created_at: Date;
  updated_at: Date;
  category_display_order?: number | null;
  product_display_order?: number | null;
  marketplace_listing_duration_days?: number | null;
}) {
  return {
    id: p.id,
    version: p.version,
    workflow: p.workflow as unknown[],
    category_display_order: p.category_display_order ?? null,
    product_display_order: p.product_display_order ?? null,
    marketplace_listing_duration_days: p.marketplace_listing_duration_days ?? null,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  };
}

/**
 * GET /v1/issuer/products
 * Active catalog only for issuer (and admin) portal; same list shape as admin products list.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = getProductsListQuerySchema.parse(req.query);
    const { products, total } = await productRepository.findAll({
      page: validated.page,
      pageSize: validated.pageSize,
      search: validated.search,
      activeOnly: true,
    });

    const pageSize = validated.pageSize;
    const totalPages = Math.ceil(total / pageSize) || 1;

    res.json({
      success: true,
      data: {
        products: products.map((p) =>
          toIssuerCatalogProduct({
            id: p.id,
            version: p.version,
            workflow: p.workflow,
            created_at: p.created_at,
            updated_at: p.updated_at,
            category_display_order: (p as { category_display_order?: number | null })
              .category_display_order,
            product_display_order: (p as { product_display_order?: number | null })
              .product_display_order,
            marketplace_listing_duration_days: (
              p as { marketplace_listing_duration_days?: number | null }
            ).marketplace_listing_duration_days,
          })
        ),
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
      error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error
    );
  }
});

/**
 * GET /v1/issuer/products/live-check/:productId
 * Resolve live ACTIVE row (same rules as application product-version-compare) for pre-create validation.
 */
router.get(
  "/live-check/:productId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId } = productIdParamsSchema.parse(req.params);
      const target = await productRepository.getVersionCompareTarget(productId.trim());

      if (target.kind === "UNAVAILABLE") {
        res.json({
          success: true,
          data: { outcome: "PRODUCT_UNAVAILABLE" as const },
          correlationId: res.locals.correlationId,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          outcome: "COMPARE" as const,
          compare_version: target.version,
          resolved_product_id: target.resolvedProductId,
        },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error
      );
    }
  }
);

/**
 * GET /v1/issuer/products/:productId
 * Read product workflow for issuer flows (e.g. offer signing). Not admin RBAC.
 */
router.get(
  "/:productId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId } = productIdParamsSchema.parse(req.params);
      const product = await productRepository.findById(productId.trim());
      if (!product || product.status === "DELETED") {
        throw new AppError(404, "NOT_FOUND", "Product not found");
      }

      res.json({
        success: true,
        data: toIssuerCatalogProduct({
          id: product.id,
          version: product.version,
          workflow: product.workflow,
          created_at: product.created_at,
          updated_at: product.updated_at,
          category_display_order: (product as { category_display_order?: number | null })
            .category_display_order,
          product_display_order: (product as { product_display_order?: number | null })
            .product_display_order,
          marketplace_listing_duration_days: (
            product as { marketplace_listing_duration_days?: number | null }
          ).marketplace_listing_duration_days,
        }),
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as issuerCatalogRouter };
