import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../lib/http/error-handler";
import { ProductRepository } from "./repository";
import { getProductsListQuerySchema } from "./schemas";

const router = Router();
const productRepository = new ProductRepository();

const liveCheckParamsSchema = z.object({
  productId: z.string().min(1),
});

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
        products: products.map((p) => ({
          id: p.id,
          version: p.version,
          workflow: p.workflow as unknown[],
          category_display_order: (p as any).category_display_order ?? null,
          product_display_order: (p as any).product_display_order ?? null,
          offer_expiry_days: (p as any).offer_expiry_days ?? null,
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
      const { productId } = liveCheckParamsSchema.parse(req.params);
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

export { router as issuerCatalogRouter };
